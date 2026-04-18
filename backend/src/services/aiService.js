/**
 * AI Predictive Maintenance Service
 * Rule-based + Statistical analysis for failure prediction
 * In production: integrate with ML model (Python FastAPI / TensorFlow Serving)
 */
'use strict';

const logger = require('../utils/logger');

/**
 * Analyze sensor trends
 */
function analyzeTrend(readings, field) {
  if (!readings || readings.length < 2) return { trend: 0, current: 0, avg: 0, stdDev: 0 };

  const values = readings.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
  if (values.length === 0) return { trend: 0, current: 0, avg: 0, stdDev: 0 };

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const current = values[values.length - 1];

  // Linear regression slope
  const n = values.length;
  const xMean = (n - 1) / 2;
  const numerator = values.reduce((sum, v, i) => sum + (i - xMean) * (v - avg), 0);
  const denominator = values.reduce((sum, _, i) => sum + Math.pow(i - xMean, 2), 0);
  const trend = denominator !== 0 ? numerator / denominator : 0;

  return { trend, current, avg, stdDev };
}

/**
 * Thresholds by equipment type
 */
const THRESHOLDS = {
  cnc: {
    vibration: { warning: 2.5, critical: 4.0 },
    temperature: { warning: 75, critical: 90 },
    noise_db: { warning: 80, critical: 90 }
  },
  pump: {
    vibration: { warning: 3.0, critical: 5.0 },
    temperature: { warning: 65, critical: 80 },
    pressure: { warning_drop_pct: 20 }
  },
  hvac: {
    temperature: { warning: 45, critical: 60 },
    current_amps: { warning_increase_pct: 25 }
  },
  compressor: {
    vibration: { warning: 3.5, critical: 6.0 },
    pressure: { warning: 8.5, critical: 7.5 },
    temperature: { warning: 85, critical: 100 }
  },
  default: {
    vibration: { warning: 3.0, critical: 5.0 },
    temperature: { warning: 80, critical: 95 }
  }
};

/**
 * Calculate risk score from equipment + sensor data
 */
function calculateRiskScore(equipment, sensorAnalysis) {
  let riskScore = 0;
  let factors = [];

  const thresholds = THRESHOLDS[equipment.type] || THRESHOLDS.default;

  // 1. Health score factor (inverse)
  const healthFactor = (100 - equipment.health_score) * 0.3;
  riskScore += healthFactor;
  if (equipment.health_score < 60) factors.push(`Low health score: ${equipment.health_score}`);

  // 2. Vibration analysis
  if (sensorAnalysis.vibration.current > 0) {
    const vibThresh = thresholds.vibration || THRESHOLDS.default.vibration;
    if (sensorAnalysis.vibration.current >= vibThresh.critical) {
      riskScore += 35;
      factors.push(`Critical vibration: ${sensorAnalysis.vibration.current.toFixed(2)} mm/s`);
    } else if (sensorAnalysis.vibration.current >= vibThresh.warning) {
      riskScore += 20;
      factors.push(`High vibration: ${sensorAnalysis.vibration.current.toFixed(2)} mm/s`);
    }
    // Trend factor
    if (sensorAnalysis.vibration.trend > 0.05) {
      riskScore += 10;
      factors.push('Vibration increasing trend');
    }
  }

  // 3. Temperature analysis
  if (sensorAnalysis.temperature.current > 0) {
    const tempThresh = thresholds.temperature || THRESHOLDS.default.temperature;
    if (sensorAnalysis.temperature.current >= tempThresh.critical) {
      riskScore += 30;
      factors.push(`Critical temperature: ${sensorAnalysis.temperature.current.toFixed(1)}°C`);
    } else if (sensorAnalysis.temperature.current >= tempThresh.warning) {
      riskScore += 15;
      factors.push(`High temperature: ${sensorAnalysis.temperature.current.toFixed(1)}°C`);
    }
  }

  // 4. Runtime hours factor
  if (equipment.runtime_hours > 8760) { // > 1 year continuous
    riskScore += 10;
    factors.push(`High runtime: ${Math.round(equipment.runtime_hours)} hours`);
  }

  // 5. Age factor
  if (equipment.install_date) {
    const ageYears = (Date.now() - new Date(equipment.install_date)) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears > 10) { riskScore += 15; factors.push(`Old equipment: ${Math.round(ageYears)} years`); }
    else if (ageYears > 7) { riskScore += 8; }
  }

  // 6. Standard deviation (instability)
  if (sensorAnalysis.vibration.stdDev > sensorAnalysis.vibration.avg * 0.3) {
    riskScore += 8;
    factors.push('Unstable vibration readings');
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(riskScore * 10) / 10)),
    factors
  };
}

/**
 * Generate recommendation based on risk factors
 */
function generateRecommendation(equipment, riskScore, factors, sensorAnalysis) {
  if (riskScore >= 75) {
    return `⚠️ IMMEDIATE ACTION: Schedule emergency maintenance within 24 hours. ${factors.slice(0, 2).join('. ')}. Check and replace bearings/seals as priority.`;
  } else if (riskScore >= 50) {
    return `⚡ HIGH PRIORITY: Plan maintenance within 7 days. Issues detected: ${factors.join('. ')}. Prepare spare parts and schedule downtime window.`;
  } else if (riskScore >= 25) {
    return `📋 MONITOR: Increase inspection frequency to daily. ${factors.join('. ')}. Review lubrication schedule and check alignment.`;
  }
  return `✅ NORMAL: Equipment operating within normal parameters. Continue standard PM schedule. Next review in 30 days.`;
}

/**
 * Predict failure for equipment
 * @param {Object} equipment - Equipment record
 * @param {Array} sensorReadings - Recent sensor readings
 */
async function predictFailure(equipment, sensorReadings) {
  logger.info(`Running prediction for equipment: ${equipment.asset_code}`);

  // Analyze each sensor metric
  const sensorAnalysis = {
    vibration: analyzeTrend(sensorReadings, 'vibration'),
    temperature: analyzeTrend(sensorReadings, 'temperature'),
    pressure: analyzeTrend(sensorReadings, 'pressure'),
    current_amps: analyzeTrend(sensorReadings, 'current_amps'),
    rpm: analyzeTrend(sensorReadings, 'rpm')
  };

  const { score: riskScore, factors } = calculateRiskScore(equipment, sensorAnalysis);
  const failureProbability = riskScore / 100;

  // Estimate days to failure based on risk score
  let daysToFailure;
  if (riskScore >= 80) daysToFailure = Math.ceil(Math.random() * 3 + 1);
  else if (riskScore >= 60) daysToFailure = Math.ceil(Math.random() * 7 + 3);
  else if (riskScore >= 40) daysToFailure = Math.ceil(Math.random() * 14 + 7);
  else if (riskScore >= 20) daysToFailure = Math.ceil(Math.random() * 30 + 14);
  else daysToFailure = 90;

  const estimatedFailureDate = new Date(Date.now() + daysToFailure * 24 * 60 * 60 * 1000);

  // Determine likely failure mode
  let failureMode = 'General wear';
  if (sensorAnalysis.vibration.current > (THRESHOLDS[equipment.type]?.vibration?.warning || 3.0)) {
    failureMode = 'Bearing wear / imbalance';
  } else if (sensorAnalysis.temperature.current > (THRESHOLDS[equipment.type]?.temperature?.warning || 80)) {
    failureMode = 'Thermal overload';
  } else if (sensorAnalysis.pressure.trend < -0.05) {
    failureMode = 'Seal / gasket degradation';
  }

  const recommendation = generateRecommendation(equipment, riskScore, factors, sensorAnalysis);

  // Confidence based on data availability
  const confidence = Math.min(95, 50 + (sensorReadings.length / 100) * 45);

  return {
    equipmentId: equipment.id,
    assetCode: equipment.asset_code,
    riskScore,
    failureProbability: Math.round(failureProbability * 10000) / 10000,
    estimatedFailureDate: estimatedFailureDate.toISOString().split('T')[0],
    daysToFailure,
    failureMode,
    recommendation,
    confidenceLevel: Math.round(confidence * 10) / 10,
    modelVersion: 'v1.0-rule-based',
    analyzedAt: new Date().toISOString(),
    inputFeatures: {
      sensorDataPoints: sensorReadings.length,
      healthScore: equipment.health_score,
      riskFactors: factors,
      sensorSummary: {
        vibration: { current: sensorAnalysis.vibration.current, trend: sensorAnalysis.vibration.trend },
        temperature: { current: sensorAnalysis.temperature.current, trend: sensorAnalysis.temperature.trend },
        pressure: { current: sensorAnalysis.pressure.current, trend: sensorAnalysis.pressure.trend }
      }
    }
  };
}

module.exports = { predictFailure, analyzeTrend, calculateRiskScore };
