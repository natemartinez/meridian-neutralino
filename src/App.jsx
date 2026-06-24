import { NODE_PALETTE } from './utils/theme.js';

import ApiKeyScreen from './components/ApiKeyScreen.jsx';
import AppRouter from './components/AppRouter.jsx';
import useAppState from './hooks/useAppState.js';
import useAppCanvas from './hooks/useAppCanvas.js';
import useGoalActions from './hooks/useGoalActions.js';

function Meridian() {
  // 1. All state, refs, effects
  const appState = useAppState();

  // 2. Derived values
  const selected = appState.projects.find((p) => p.id === appState.selectedId);
  const colorFor = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

  // 3. Event handlers (goals, onward, skills, focus, AI)
  // Must come before useAppCanvas because useAppCanvas needs confirmPendingDrop / cancelPendingDrop
  const actions = useGoalActions({
    ...appState,
    selected,
    colorFor,
    closeWaypoint: appState.closeWaypoint,
  });

  // 4. Canvas draw loop + mouse handlers
  const canvasHandlers = useAppCanvas({
    ...appState,
    openWaypoint: appState.openWaypoint,
    closeWaypoint: appState.closeWaypoint,
    confirmPendingDrop: actions.confirmPendingDrop,
    cancelPendingDrop: actions.cancelPendingDrop,
  });

  if (!appState.loaded) return null;
  if (!appState.apiKey) return <ApiKeyScreen onSave={appState.setApiKey} />;

  // 5. Render — pass everything as props to AppRouter
  return (
    <AppRouter
      {...appState}
      {...canvasHandlers}
      {...actions}
      selected={selected}
      colorFor={colorFor}
    />
  );
}

export default Meridian;
