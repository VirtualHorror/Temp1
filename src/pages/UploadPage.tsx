import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileUp, CheckCircle, XCircle } from 'lucide-react';

const UploadPage = () => {
  const navigate = useNavigate();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Please upload a ZIP file from Google Takeout');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      setUploadStatus('success');
      // Store the fileHash in localStorage for the dashboard
      localStorage.setItem('currentFileHash', result.fileHash);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload file');
      setUploadStatus('error');
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    maxFiles: 1
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Upload className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Upload Evidence File
          </h2>
          <p className="mt-2 text-gray-600">
            Upload your Google Takeout ZIP file containing smartwatch data
          </p>
        </div>

        <div 
          {...getRootProps()} 
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${uploadStatus === 'success' ? 'border-green-500 bg-green-50' : ''}
            ${uploadStatus === 'error' ? 'border-red-500 bg-red-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {uploadStatus === 'idle' && (
            <div>
              <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg text-gray-600">
                {isDragActive
                  ? "Drop the file here"
                  : "Drag and drop your ZIP file here, or click to select"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Only ZIP files from Google Takeout are supported
              </p>
            </div>
          )}

          {uploadStatus === 'uploading' && (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Processing your file...</p>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg text-green-600">File uploaded successfully!</p>
              <p className="text-sm text-green-500 mt-2">
                Redirecting to dashboard...
              </p>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div>
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-lg text-red-600">{errorMessage}</p>
              <p className="text-sm text-red-500 mt-2">
                Please try again with a valid file
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;