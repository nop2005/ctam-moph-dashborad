export const isRetriableBackendError = (error: any) => {
  const status = error?.status ?? error?.statusCode;
  const code = error?.code;

  return code === 'PGRST002' || status === 502 || status === 503 || status === 504;
};

type CircuitState = {
  disabledUntil: number;
  lastDelayMs: number;
};

const state: CircuitState = {
  disabledUntil: 0,
  lastDelayMs: 0,
};

export const backendCircuit = {
  canRequest: () => Date.now() >= state.disabledUntil,

  getDisabledMsRemaining: () => Math.max(0, state.disabledUntil - Date.now()),

  reportFailure: (error: any) => {
    if (!isRetriableBackendError(error)) return;

    // Exponential cooldown to avoid thundering herd during outages.
    const nextDelayMs = state.lastDelayMs
      ? Math.min(Math.max(state.lastDelayMs * 2, 4000), 30000)
      : 4000;

    state.lastDelayMs = nextDelayMs;
    state.disabledUntil = Date.now() + nextDelayMs;
  },

  reportSuccess: () => {
    state.lastDelayMs = 0;
    state.disabledUntil = 0;
  },
};
