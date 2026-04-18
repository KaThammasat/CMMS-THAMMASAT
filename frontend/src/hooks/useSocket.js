/**
 * useSocket - Real-time Socket.IO hook
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuthStore, useAlertStore } from '../store';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

export function useSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const { addAlert } = useAlertStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;

    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      if (user) {
        socketInstance.emit('auth', { userId: user.id, siteId: user.siteId });
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // ─── Real-time events ────────────────────────────────────
    socketInstance.on('alert:sla_warning', (data) => {
      toast.error(`⚠️ SLA Warning: ${data.woNumber} — ${data.hoursRemaining.toFixed(1)}h remaining`, {
        duration: 8000,
        id: `sla-${data.woNumber}`
      });
      addAlert({ type: 'sla_warning', severity: data.severity, ...data, timestamp: new Date() });
    });

    socketInstance.on('workOrder:created', (data) => {
      toast.success(`📋 New WO: ${data.wo_number}`, { duration: 5000 });
      addAlert({ type: 'work_order', ...data, timestamp: new Date() });
    });

    socketInstance.on('downtime:started', (data) => {
      toast.error(`🔴 Breakdown started: Equipment down`, { duration: 6000 });
      addAlert({ type: 'breakdown', ...data, timestamp: new Date() });
    });

    socketInstance.on('downtime:ended', (data) => {
      const minutes = Math.round(data.durationMinutes);
      toast.success(`✅ Equipment restored after ${minutes} min`, { duration: 5000 });
    });

    socketInstance.on('alert:low_stock', (data) => {
      toast(`📦 Low stock: ${data.name} (${data.onHand} left)`, {
        icon: '⚠️', duration: 5000
      });
      addAlert({ type: 'stock', ...data, timestamp: new Date() });
    });

    socketInstance.on('alert:new', (data) => {
      addAlert({ ...data, timestamp: new Date() });
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        initialized.current = false;
      }
    };
  }, [isAuthenticated, user]);

  return socketInstance;
}

export function subscribeToEquipment(equipmentId) {
  socketInstance?.emit('subscribe:equipment', equipmentId);
}

export function unsubscribeFromEquipment(equipmentId) {
  socketInstance?.emit('unsubscribe:equipment', equipmentId);
}

export { socketInstance };
