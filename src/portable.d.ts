interface Window {
  keroppilotDesktop?: {
    readKey(): Promise<import('./services/apiKey').StoredApiKey>;
    saveKey(key: string): Promise<import('./services/apiKey').StoredApiKey>;
    clearKey(): Promise<void>;
    pin(value: boolean): Promise<void>;
    copy(text: string): Promise<void>;
    open(destination: 'chatgpt' | 'deepseek'): Promise<void>;
  };
}
