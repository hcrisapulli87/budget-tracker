import { supabase } from '../lib/supabase'
import type { TaxDocument } from './types'

const BUCKET = 'tax-docs'

export interface TaxDocumentMeta {
  owner_id: string
  fy: number
  title: string
  doc_type: TaxDocument['doc_type']
  link_type: TaxDocument['link_type']
  link_id?: string | null
  amount?: number | null
  date?: string | null
}

export async function listDocuments(fy: number): Promise<TaxDocument[]> {
  const { data, error } = await supabase
    .from('tax_documents')
    .select('*')
    .eq('fy', fy)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as TaxDocument[]
}

export async function uploadDocument(file: File, meta: TaxDocumentMeta): Promise<void> {
  const path = `${meta.owner_id}/${meta.fy}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
  if (uploadError) throw uploadError
  const { error: insertError } = await supabase.from('tax_documents').insert({
    owner_id: meta.owner_id,
    fy: meta.fy,
    title: meta.title,
    doc_type: meta.doc_type,
    storage_path: path,
    link_type: meta.link_type,
    link_id: meta.link_id ?? null,
    amount: meta.amount ?? null,
    date: meta.date ?? null,
  })
  if (insertError) throw insertError
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) throw storageError
  const { error } = await supabase.from('tax_documents').delete().eq('id', id)
  if (error) throw error
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
