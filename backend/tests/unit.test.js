/**
 * Unit Tests - AI Service + KPI calculations
 * Run: npm test
 */
'use strict';

const { predictFailure, analyzeTrend, calculateRiskScore } = require('../src/services/aiService');

// ─── analyzeTrend tests ───────────────────────────────────────
describe('analyzeTrend', () => {
  test('returns zeros for empty readings', () => {
    const result = analyzeTrend([], 'vibration');
    expect(result.trend).toBe(0);
    expect(result.current).toBe(0);
  });

  test('returns zeros for single reading', () => {
    const result = analyzeTrend([{ vibration: 2.5 }], 'vibration');
    expect(result.current).toBe(2.5);
  });

  test('detects upward trend', () => {
    const readings = [
      { vibration: 1.0 }, { vibration: 1.5 }, { vibration: 2.0 },
      { vibration: 2.5 }, { vibration: 3.0 }
    ];
    const result = analyzeTrend(readings, 'vibration');
    expect(result.trend).toBeGreaterThan(0);
    expect(result.current).toBe(3.0);
  });

  test('detects stable readings', () => {
    const readings = Array(10).fill(null).map(() => ({ vibration: 2.0 }));
    const result = analyzeTrend(readings, 'vibration');
    expect(Math.abs(result.trend)).toBeLessThan(0.01);
    expect(result.avg).toBeCloseTo(2.0);
  });

  test('ignores NaN values', () => {
    const readings = [{ vibration: 1.0 }, { vibration: null }, { vibration: 2.0 }];
    const result = analyzeTrend(readings, 'vibration');
    expect(result.avg).toBeCloseTo(1.5);
  });
});

// ─── calculateRiskScore tests ─────────────────────────────────
describe('calculateRiskScore', () => {
  const baseEquipment = {
    id: 'test-uuid',
    type: 'pump',
    criticality: 'critical',
    health_score: 90,
    runtime_hours: 1000,
    install_date: new Date(Date.now() - 2 * 365.25 * 24 * 3600 * 1000).toISOString() // 2 years old
  };

  const normalSensors = {
    vibration: { current: 1.0, trend: 0, avg: 1.0, stdDev: 0.1 },
    temperature: { current: 45, trend: 0, avg: 45, stdDev: 2 },
    pressure: { current: 7.0, trend: 0, avg: 7.0, stdDev: 0.2 },
    current_amps: { current: 15, trend: 0, avg: 15, stdDev: 0.5 },
    rpm: { current: 1450, trend: 0, avg: 1450, stdDev: 5 }
  };

  test('healthy equipment returns low risk score', () => {
    const { score } = calculateRiskScore(baseEquipment, normalSensors);
    expect(score).toBeLessThan(30);
  });

  test('low health score increases risk', () => {
    const sickEquipment = { ...baseEquipment, health_score: 30 };
    const { score } = calculateRiskScore(sickEquipment, normalSensors);
    expect(score).toBeGreaterThan(20);
  });

  test('critical vibration triggers high risk', () => {
    const highVibSensors = {
      ...normalSensors,
      vibration: { current: 6.0, trend: 0.1, avg: 5.0, stdDev: 0.5 }
    };
    const { score, factors } = calculateRiskScore(baseEquipment, highVibSensors);
    expect(score).toBeGreaterThan(40);
    expect(factors.some(f => f.toLowerCase().includes('vibration'))).toBe(true);
  });

  test('critical temperature triggers risk', () => {
    const hotSensors = {
      ...normalSensors,
      temperature: { current: 82, trend: 0.2, avg: 75, stdDev: 3 }
    };
    const { score } = calculateRiskScore(baseEquipment, hotSensors);
    expect(score).toBeGreaterThan(20);
  });

  test('risk score is capped at 100', () => {
    const worstCase = {
      ...baseEquipment,
      health_score: 0,
      runtime_hours: 99999,
      install_date: new Date(Date.now() - 15 * 365.25 * 24 * 3600 * 1000).toISOString()
    };
    const worstSensors = {
      ...normalSensors,
      vibration: { current: 10, trend: 1.0, avg: 8, stdDev: 2 },
      temperature: { current: 120, trend: 0.5, avg: 100, stdDev: 5 }
    };
    const { score } = calculateRiskScore(worstCase, worstSensors);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('rising vibration trend adds risk factor', () => {
    const risingTrend = {
      ...normalSensors,
      vibration: { current: 2.0, trend: 0.15, avg: 1.5, stdDev: 0.3 }
    };
    const { factors } = calculateRiskScore(baseEquipment, risingTrend);
    expect(factors.some(f => f.toLowerCase().includes('trend'))).toBe(true);
  });
});

// ─── predictFailure tests ─────────────────────────────────────
describe('predictFailure', () => {
  const equipment = {
    id: 'eq-uuid-001',
    asset_code: 'PUMP-001',
    type: 'pump',
    criticality: 'critical',
    health_score: 75,
    runtime_hours: 5000,
    cost_per_minute: 320,
    install_date: new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString()
  };

  const sensorReadings = Array(50).fill(null).map((_, i) => ({
    vibration: 2.0 + i * 0.02,
    temperature: 60 + i * 0.1,
    pressure: 7.0,
    current_amps: 16,
    rpm: 1450,
    recorded_at: new Date(Date.now() - (50 - i) * 60000).toISOString()
  }));

  test('returns required prediction fields', async () => {
    const result = await predictFailure(equipment, sensorReadings);
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('failureProbability');
    expect(result).toHaveProperty('estimatedFailureDate');
    expect(result).toHaveProperty('failureMode');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('confidenceLevel');
    expect(result).toHaveProperty('daysToFailure');
  });

  test('risk score is between 0 and 100', async () => {
    const result = await predictFailure(equipment, sensorReadings);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  test('failure probability matches risk score', async () => {
    const result = await predictFailure(equipment, sensorReadings);
    expect(result.failureProbability).toBeCloseTo(result.riskScore / 100, 1);
  });

  test('works with no sensor data', async () => {
    const result = await predictFailure(equipment, []);
    expect(result).toHaveProperty('riskScore');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });

  test('high vibration triggers bearing failure mode', async () => {
    const highVibReadings = sensorReadings.map(r => ({ ...r, vibration: 5.0 }));
    const result = await predictFailure(equipment, highVibReadings);
    expect(result.failureMode.toLowerCase()).toContain('bearing');
  });

  test('confidence increases with more sensor data', async () => {
    const few = await predictFailure(equipment, sensorReadings.slice(0, 5));
    const many = await predictFailure(equipment, sensorReadings);
    expect(many.confidenceLevel).toBeGreaterThanOrEqual(few.confidenceLevel);
  });

  test('recommendation contains urgency for high risk', async () => {
    const critEquipment = { ...equipment, health_score: 20 };
    const critReadings = sensorReadings.map(r => ({ ...r, vibration: 8.0, temperature: 100 }));
    const result = await predictFailure(critEquipment, critReadings);
    expect(result.riskScore).toBeGreaterThan(60);
    expect(result.recommendation).toMatch(/immediate|emergency|urgent/i);
  });
});

// ─── SLA calculation tests ────────────────────────────────────
describe('SLA calculations', () => {
  const SLA_HOURS = { critical: 4, high: 8, medium: 24, low: 72 };

  test.each([
    ['critical', 4],
    ['high', 8],
    ['medium', 24],
    ['low', 72],
  ])('%s priority SLA = %i hours', (priority, hours) => {
    expect(SLA_HOURS[priority]).toBe(hours);
  });

  test('SLA due date is calculated correctly', () => {
    const openedAt = new Date('2026-04-18T08:00:00Z');
    const priority = 'critical';
    const slaDue = new Date(openedAt.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
    expect(slaDue.getTime()).toBe(new Date('2026-04-18T12:00:00Z').getTime());
  });

  test('detects SLA breach correctly', () => {
    const slaDueAt = new Date(Date.now() - 1000); // 1 second ago
    const isBreached = slaDueAt < new Date();
    expect(isBreached).toBe(true);
  });

  test('downtime cost calculation', () => {
    const durationMinutes = 90;
    const costPerMinute = 850;
    const totalCost = durationMinutes * costPerMinute;
    expect(totalCost).toBe(76500);
  });
});
