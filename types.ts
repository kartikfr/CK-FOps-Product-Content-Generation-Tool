export interface ScrapedContent {
  url: string;
  title: string;
  description: string;
  content: string; // The main body text
  h1: string[];
  links: number;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  metadata?: Record<string, any>;
}

export interface TransformationResult {
  originalUrl: string;
  transformedContent: string;
  status: 'success' | 'failed';
  error?: string;
  processingTimeMs: number;
}

export interface BulkJobItem {
  id: string;
  url: string;
  scrapeStatus: 'idle' | 'pending' | 'success' | 'failed';
  scrapedData?: ScrapedContent;
  transformStatus: 'idle' | 'pending' | 'success' | 'failed';
  transformedData?: string;
  error?: string;
}

export enum AppView {
  HOME = 'HOME',
  SINGLE = 'SINGLE',
  BULK = 'BULK',
  HISTORY = 'HISTORY'
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface SampleFile {
  name: string;
  content: string;
  type: 'csv' | 'json' | 'text' | 'excel';
}