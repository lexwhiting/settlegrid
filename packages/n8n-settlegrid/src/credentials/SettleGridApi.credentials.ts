import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SettleGridApi implements ICredentialType {
  name = 'settleGridApi';
  displayName = 'SettleGrid API';
  documentationUrl = 'https://settlegrid.ai/docs';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your SettleGrid API key from the developer dashboard',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://settlegrid.ai',
      description: 'SettleGrid API base URL (override for self-hosted instances)',
    },
  ];
}
