import { useState, useEffect } from 'react';
import { calculateDeadlineAlerts } from '../utils/helpers.js';

/**
 * Computes deadline alerts from projects after a short delay (for startup).
 * Returns { showDeadlineNotifier, deadlineAlerts, dismissAlerts }.
 */
export default function useDeadlineAlerts(projects, loaded) {
  const [showDeadlineNotifier, setShowDeadlineNotifier] = useState(false);
  const [deadlineAlerts, setDeadlineAlerts] = useState([]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      const alerts = calculateDeadlineAlerts(projects);
      if (alerts.length > 0) {
        setDeadlineAlerts(alerts);
        setShowDeadlineNotifier(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [loaded, projects]);

  const dismissAlerts = () => setShowDeadlineNotifier(false);

  return { showDeadlineNotifier, deadlineAlerts, dismissAlerts };
}
