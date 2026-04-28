import React, { useState } from 'react';
import { useData, Relation, RelationType } from '../lib/DataContext';
import { X, Plus, Pencil, Trash2, Network, ArrowRight } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: 'one-to-one', label: '1 : 1' },
  { value: 'one-to-many', label: '1 : N' },
  { value: 'many-to-many', label: 'N : N' },
];

const RELATION_COLORS: Record<RelationType, string> = {
  'one-to-one': 'bg-green-400',
  'one-to-many': 'bg-blue-400',
  'many-to-many': 'bg-purple-400',
};

// Return the set of field ids (tableId:fieldName) that participate in at least one relation
function relatedFieldSet(relations: Relation[]): Set<string> {
  const set = new Set<string>();
  relations.forEach(r => {
    set.add(`${r.fromTable}:${r.fromField}`);
    set.add(`${r.toTable}:${r.toField}`);
  });
  return set;
}

interface RelationFormState {
  id?: string;
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  type: RelationType;
}

const EMPTY_FORM: RelationFormState = {
  fromTable: '',
  fromField: '',
  toTable: '',
  toField: '',
  type: 'one-to-many',
};

export default function ERDModal({ onClose }: Props) {
  const { tables, relations, upsertRelation, removeRelation } = useData();
  const [form, setForm] = useState<RelationFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const relatedFields = relatedFieldSet(relations);

  const fromTableObj = tables.find(t => t.id === form.fromTable);
  const toTableObj   = tables.find(t => t.id === form.toTable);

  // ── Form helpers ────────────────────────────────────────────────────────────

  const startEdit = (r: Relation) => {
    setForm({ id: r.id, fromTable: r.fromTable, fromField: r.fromField, toTable: r.toTable, toField: r.toField, type: r.type });
    setEditingId(r.id);
    setFormError('');
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
  };

  const handleSave = () => {
    if (!form.fromTable || !form.fromField || !form.toTable || !form.toField) {
      setFormError('All four fields are required.');
      return;
    }
    if (form.fromTable === form.toTable && form.fromField === form.toField) {
      setFormError('From and To cannot be the same field on the same table.');
      return;
    }
    upsertRelation({ ...form, id: editingId ?? undefined });
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
  };

  const setFormField = <K extends keyof RelationFormState>(key: K, value: RelationFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormError('');
    // Reset dependent fields when table changes
    if (key === 'fromTable') setForm(prev => ({ ...prev, fromTable: value as string, fromField: '' }));
    if (key === 'toTable')   setForm(prev => ({ ...prev, toTable: value as string, toField: '' }));
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getTableName = (id: string) => tables.find(t => t.id === id)?.name ?? id;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            Entity Relationship Diagram
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body: two-pane layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left pane: Table cards ────────────────────────────────────── */}
          <div className="w-3/5 border-r border-gray-100 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Tables ({tables.length})
            </h3>

            {tables.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No tables loaded yet. Connect a data source first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {tables.map(table => (
                  <div key={table.id} className="rounded-lg border border-gray-200 overflow-hidden text-sm shadow-sm">
                    {/* Card header */}
                    <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
                      <p className="font-semibold text-blue-900 truncate" title={table.name}>{table.name}</p>
                      <p className="text-[10px] text-blue-500">{table.data.length.toLocaleString()} rows · {table.fields.length} fields</p>
                    </div>
                    {/* Field list */}
                    <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                      {table.fields.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400 italic">No fields (data not loaded)</p>
                      ) : (
                        table.fields.map(field => {
                          const key = `${table.id}:${field}`;
                          const isInRelation = relatedFields.has(key);
                          return (
                            <div key={field} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
                              {isInRelation && (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0 bg-blue-400"
                                  title="This field participates in a relation"
                                />
                              )}
                              <span className={`text-xs truncate ${isInRelation ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                {field}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right pane: Relations + form ─────────────────────────────── */}
          <div className="w-2/5 flex flex-col overflow-hidden">
            {/* Relations list */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Relations ({relations.length})
              </h3>

              {relations.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  No relations defined yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {relations.map(r => (
                    <div
                      key={r.id}
                      className={`rounded-lg border px-3 py-2.5 ${editingId === r.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-xs font-medium text-gray-800 flex-wrap">
                            <span className="text-blue-700 truncate max-w-[80px]" title={getTableName(r.fromTable)}>
                              {getTableName(r.fromTable)}
                            </span>
                            <span className="text-gray-500 shrink-0">.{r.fromField}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-blue-700 truncate max-w-[80px]" title={getTableName(r.toTable)}>
                              {getTableName(r.toTable)}
                            </span>
                            <span className="text-gray-500 shrink-0">.{r.toField}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${RELATION_COLORS[r.type]}`} />
                            <span className="text-[10px] text-gray-500">
                              {RELATION_TYPES.find(t => t.value === r.type)?.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(r)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeRelation(r.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add / Edit relation form */}
            <div className="shrink-0 border-t border-gray-100 p-4 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {editingId ? 'Edit Relation' : 'Add Relation'}
              </h3>

              <div className="flex flex-col gap-2.5">
                {/* From table + field */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">From Table</label>
                    <select
                      value={form.fromTable}
                      onChange={(e) => setFormField('fromTable', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select table…</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">From Field</label>
                    <select
                      value={form.fromField}
                      onChange={(e) => setFormField('fromField', e.target.value)}
                      disabled={!fromTableObj}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select field…</option>
                      {(fromTableObj?.fields ?? []).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* To table + field */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">To Table</label>
                    <select
                      value={form.toTable}
                      onChange={(e) => setFormField('toTable', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select table…</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">To Field</label>
                    <select
                      value={form.toField}
                      onChange={(e) => setFormField('toField', e.target.value)}
                      disabled={!toTableObj}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select field…</option>
                      {(toTableObj?.fields ?? []).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Relation type */}
                <div>
                  <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">Relation Type</label>
                  <div className="flex gap-2">
                    {RELATION_TYPES.map(rt => (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setFormField('type', rt.value)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          form.type === rt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {rt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{formError}</p>
                )}

                <div className="flex gap-2 pt-1">
                  {editingId && (
                    <button
                      onClick={cancelEdit}
                      className="flex-1 py-1.5 px-3 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="flex-1 py-1.5 px-3 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {editingId ? 'Update' : 'Add Relation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
