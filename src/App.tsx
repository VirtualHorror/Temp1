import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">IoT Evidence Extractor</h1>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".zip"
              onChange={handleFileUpload}
              className="hidden"
              id="fileUpload"
            />
            <label
              htmlFor="fileUpload"
              className="flex flex-col items-center cursor-pointer"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-gray-600">
                {file ? file.name : 'Click to upload Google Takeout ZIP file'}
              </span>
            </label>
          </div>

          {loading && (
            <div className="mt-4 text-center text-gray-600">
              Processing file...
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {data && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Extracted Data</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p>Devices found: {data.devices.length}</p>
                <p>Metrics found: {data.metrics.length}</p>
                <p>Total data points: {data.data.length}</p>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Available Metrics:</h3>
                <ul className="list-disc list-inside">
                  {data.metrics.map((metric: string, index: number) => (
                    <li key={index} className="text-gray-700">{metric}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Devices:</h3>
                <ul className="list-disc list-inside">
                  {data.devices.map((device: string, index: number) => (
                    <li key={index} className="text-gray-700">{device}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;