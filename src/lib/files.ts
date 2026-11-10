// Diagram storage: every call goes straight to Supabase, and row level security keeps each user to their own files.
import { diagramSize } from '../core/render.ts';
import type { DiagramTemplate } from '../core/templates.ts';
import type { CanvasElement } from '../core/types.ts';
import { supabase } from './supabase.ts';

export interface FileSummary { id: string; title: string; updatedAt: number; elements: CanvasElement[] }
export interface DiagramFile { id: string; title: string; elements: CanvasElement[] }

export class DataError extends Error {}
const fail = (error: { message: string } | null): never => { throw new DataError(error?.message ?? 'Something went wrong'); };

/** A drawing abandoned before anything was added isn't worth listing. */
const isBlank = (title: string, elements: CanvasElement[]) => elements.length === 0 && title === 'Untitled architecture';

export async function listFiles(): Promise<FileSummary[]> {
  const { data, error } = await supabase.from('files').select('id, title, canvas, updated_at')
    .is('deleted_at', null).order('updated_at', { ascending: false }).limit(200);
  if (error) fail(error);
  return (data ?? [])
    .map((r) => ({ id: r.id as string, title: r.title as string, updatedAt: Date.parse(r.updated_at as string), elements: r.canvas as CanvasElement[] }))
    .filter((f) => !isBlank(f.title, f.elements));
}

export async function getFile(id: string): Promise<DiagramFile | null> {
  const { data, error } = await supabase.from('files').select('id, title, canvas').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) fail(error);
  return data ? { id: data.id as string, title: data.title as string, elements: data.canvas as CanvasElement[] } : null;
}

export async function createFile(title: string, elements: CanvasElement[] = []): Promise<string> {
  const { data, error } = await supabase.from('files').insert({ title: title.trim().slice(0, 200) || 'Untitled', canvas: elements }).select('id').single();
  if (error) fail(error);
  return data!.id as string;
}

export async function createFromTemplate(t: DiagramTemplate): Promise<string> {
  const size = diagramSize({ diagramType: t.type, code: t.code });
  const el: CanvasElement = { id: crypto.randomUUID().slice(0, 12), x: 0, y: 0, z: 1, ...size, type: 'diagram', diagramType: t.type, code: t.code, title: t.name };
  return createFile(t.name, [el]);
}

export async function renameFile(id: string, title: string) {
  const { error } = await supabase.from('files').update({ title: title.trim().slice(0, 200) || 'Untitled' }).eq('id', id);
  if (error) fail(error);
}

export async function saveElements(id: string, elements: CanvasElement[]) {
  const { error } = await supabase.from('files').update({ canvas: elements }).eq('id', id);
  if (error) fail(error);
}

/** Marks the file deleted rather than removing the row, so it can be brought back. */
export async function deleteFile(id: string) {
  const { error } = await supabase.from('files').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
}
