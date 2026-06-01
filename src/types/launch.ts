export type LaunchProfile = {
  id: string;
  gameId: string;
  name: string;
  executablePath: string;
  workingDirectory?: string | null;
  arguments?: string | null;
  environmentVariables?: string | null;
  runnerType: 'direct' | 'locale_emulator' | 'custom_command' | 'shortcut_lnk' | string;
  localeEmulatorPath?: string | null;
  preLaunchCommand?: string | null;
  postLaunchCommand?: string | null;
  runAsAdmin: boolean;
  isDefault: boolean;
  compatibilityNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LaunchProfileInput = {
  gameId: string;
  name: string;
  executablePath: string;
  workingDirectory?: string | null;
  arguments?: string | null;
  environmentVariables?: string | null;
  runnerType?: string | null;
  localeEmulatorPath?: string | null;
  preLaunchCommand?: string | null;
  postLaunchCommand?: string | null;
  runAsAdmin?: boolean | null;
  isDefault?: boolean | null;
  compatibilityNotes?: string | null;
};

export type LaunchProfileUpdate = Partial<Omit<LaunchProfileInput, 'gameId'>>;
