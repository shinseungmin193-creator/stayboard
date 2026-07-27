declare const basePathConfig: {
  readonly APP_BASE_PATH: string;
  readonly normalizeBasePath: (value: string | undefined) => string;
  readonly resolveBasePath: (value: string | undefined, nodeEnv: string | undefined) => string;
};

export = basePathConfig;
