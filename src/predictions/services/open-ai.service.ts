import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { AggregatedInput } from './aggregator.service';

export type PredictionResult = {
  recommendation: 'send' | 'wait' | 'alternative';
  riskLevel: 'low' | 'medium' | 'high';
  bestDepartureTime: string;
  expectedDelayMinutes: number;
  shortExplanation: string;
};

type OpenAiResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

const SYSTEM_PROMPT = `You are a logistics analyst for CaspX, a Kazakhstani cargo transportation platform.

Evaluate the feasibility of shipping cargo based on the provided data.

Return ONLY valid JSON with no markdown formatting, no code blocks, no extra text. The JSON must have these fields:

{
  "recommendation": "send" | "wait" | "alternative",
  "riskLevel": "low" | "medium" | "high",
  "bestDepartureTime": "ISO 8601 datetime string",
  "expectedDelayMinutes": number,
  "shortExplanation": "string (1-2 sentences in Russian)"
}

Consider: route distance & duration, weather conditions (wind, rain, snow), checkpoint load & wait times, railway node load.`;

@Injectable()
export class OpenAiService {
  constructor(private readonly httpService: HttpService) {}

  async predict(input: AggregatedInput): Promise<PredictionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadGatewayException('OPENAI_API_KEY is not configured');
    }

    let response: AxiosResponse<OpenAiResponse>;
    try {
      response = await firstValueFrom(
        this.httpService.post<OpenAiResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: JSON.stringify(input),
              },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        if (!error.response) {
          throw new BadGatewayException('OpenAI is unavailable');
        }
        throw new BadGatewayException(
          `OpenAI request failed: ${error.response.status}`,
        );
      }
      throw new BadGatewayException('OpenAI prediction failed');
    }

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadGatewayException('OpenAI returned empty response');
    }

    return JSON.parse(content) as PredictionResult;
  }
}
