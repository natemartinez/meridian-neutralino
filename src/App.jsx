import { NODE_PALETTE } from './utils/theme.js';
import { createActionRegistry } from './engine/actionRegistry.js';

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

  // 5. Action Registry — wraps hook functions for NOVA action execution
  const actionRegistry = createActionRegistry({
    startSession: appState.startSession,
    stopSession: appState.stopSession,
    toggleSubtask: actions.toggleSubtask,
    createGoalFromModal: actions.createGoalFromModal,
    addOnwardItem: actions.addOnwardItem,
    setFocus: appState.setFocus,
    addKnowledgeEntry: appState.addKnowledgeEntry,
    updateCorrections: appState.updateCorrections,
    onSubNav: appState.onSubNav,
    onOpenProgramWithPage: appState.onOpenProgramWithPage,
    setSelectedForToday: appState.setSelectedForToday,
    finishBriefing: () => {}, // stub — injected by NOVAProgramPanel at runtime
    generateNovaPlan: appState.generateNovaPlan,
    toggleOnwardDone: actions.toggleOnwardDone,
    completeGoal: actions.completeGoal,
    renameGoal: actions.renameGoal,
    deleteGoal: actions.deleteGoal,
  });

  if (!appState.loaded) return null;
  if (!appState.apiKey) return <ApiKeyScreen onSave={appState.setApiKey} />;

  // 6. Render — pass everything as props to AppRouter
  return (
    <AppRouter
      {...appState}
      {...canvasHandlers}
      {...actions}
      actionRegistry={actionRegistry}
      selected={selected}
      colorFor={colorFor}
    />
  );
}

export default Meridian;
