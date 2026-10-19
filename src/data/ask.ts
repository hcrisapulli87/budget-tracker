import { supabase } from '../lib/supabase'

export interface AskTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Ask the Tally assistant (Supabase Edge Function `tally-ask`) about a snapshot of your money. */
export async function askTally(question: string, context: unknown, history: AskTurn[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('tally-ask', { body: { question, context, history } })
  if (error) {
    // the function's own JSON error message is more useful than the generic one
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'The assistant is unavailable right now.')
  }
  if (data?.error) throw new Error(data.error)
  return String(data?.answer ?? '')
}
