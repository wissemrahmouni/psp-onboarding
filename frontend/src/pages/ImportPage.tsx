import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    batch_id: string;
    success_count: number;
    created_count?: number;
    updated_count?: number;
    error_count: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const token = (window as unknown as { __psp_access_token?: string }).__psp_access_token;
    fetch('/api/affiliates/import/excel', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setFile(null);
      })
      .catch((err) => setResult({ batch_id: '', success_count: 0, error_count: 1, errors: [{ row: 0, message: err.message }] }))
      .finally(() => setUploading(false));
  };

  const downloadTemplate = () => {
    const token = (window as unknown as { __psp_access_token?: string }).__psp_access_token;
    fetch('/api/affiliates/template', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'modele_AFFILIATION_BO1902.xlsx';
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Importer des affiliés (Excel)</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <p className="text-gray-600 mb-2">Déposez un fichier .xlsx ou .xls ici ou</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
                else setFile(null);
              }}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="inline-block px-4 py-2 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300">
              Parcourir
            </label>
            {file && <p className="mt-2 text-sm font-medium text-gray-800">{file.name}</p>}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {uploading ? 'Import en cours...' : 'Importer'}
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              Télécharger le modèle Excel
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-medium mb-4">Résultat</h2>
          <p className="text-green-600 font-medium">
            {result.success_count} ligne(s) traitée(s).
            {result.created_count !== undefined && result.updated_count !== undefined && (
              <span className="text-gray-600 font-normal">
                {' '}({result.created_count} créée(s), {result.updated_count} mise(s) à jour)
              </span>
            )}
          </p>
          {result.error_count > 0 && (
            <p className="text-red-600 font-medium">{result.error_count} erreur(s).</p>
          )}
          {result.errors.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Ligne</th>
                  <th className="text-left py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i} className="border-b text-red-700">
                    <td className="py-2">{e.row}</td>
                    <td className="py-2">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/affiliates" className="inline-block mt-4 text-blue-600 hover:underline">
            Voir les affiliés
          </Link>
        </div>
      )}
    </div>
  );
}
