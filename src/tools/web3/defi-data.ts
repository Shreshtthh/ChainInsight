import { createTool } from '@iqai/adk';
import axios from 'axios';
import { z } from 'zod';

export const defiDataTool = createTool({
  name: 'query_defi_protocol',
  description: 'Query DeFi protocol data including TVL, yields, and pool information from DeFiLlama',
  schema: z.object({
    protocol: z.string().optional().describe('Specific protocol name to query'),
    chain: z.string().optional().describe('Blockchain network (e.g., "base", "ethereum")'),
    action: z.enum(['tvl', 'yields', 'pools']).describe('Type of data to retrieve')
  }),
  fn: async (params: { 
    protocol?: string;
    chain?: string;
    action: 'tvl' | 'yields' | 'pools';
  }) => {
    try {
      let url = 'https://api.llama.fi';
      
      switch (params.action) {
        case 'tvl':
          url += params.protocol 
            ? `/protocol/${params.protocol}` 
            : '/protocols';
          break;
        case 'yields':
          url += '/pools';
          break;
        case 'pools':
          url += `/pools`;
          break;
      }

      const response = await axios.get(url);
      
      let data = response.data;
      if (params.chain && Array.isArray(data)) {
        data = data.filter((item: any) => 
          item.chain?.toLowerCase() === params.chain?.toLowerCase()
        );
      }

      return JSON.stringify({
        success: true,
        data: Array.isArray(data) ? data.slice(0, 10) : data,
        source: 'DeFiLlama API',
        chain: params.chain
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});
