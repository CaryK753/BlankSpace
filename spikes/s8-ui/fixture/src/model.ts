export const states = [
  'loading', 'empty', 'ready', 'refreshing', 'error',
  'permission-denied', 'offline', 'unsupported',
] as const;

export type ScreenState = typeof states[number];
export type ShellId = 'default-shell' | 'workbench-shell';

export interface RouteContribution {
  id: string;
  path: string;
  title: string;
  access: string;
}

export interface NavigationContribution {
  id: string;
  routeId: string;
  label: string;
  region: string;
}

export interface ContributionSet {
  schemaVersion: string;
  routes: RouteContribution[];
  navigation: NavigationContribution[];
  commands: Array<{id: string; label: string; scope: string}>;
}
