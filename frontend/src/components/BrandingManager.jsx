import { useState, useEffect } from 'react'
import axios from 'axios'
import { PhotoIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline'

const BrandingManager = () => {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/branding')
      setConfig(response.data)
      setLoading(false)
    } catch (error) {
      setError('Failed to load branding configuration')
      setLoading(false)
    }
  }

  const handleColorChange = async (colorType, value) => {
    try {
      const newConfig = { ...config }
      newConfig.colors[colorType] = value
      await axios.put('/api/branding/colors', newConfig.colors)
      setConfig(newConfig)
    } catch (error) {
      setError('Failed to update colors')
    }
  }

  const handleFontUpload = async (type, style, file) => {
    try {
      const formData = new FormData()
      formData.append('font', file)
      await axios.post(`/api/branding/fonts/${type}?style=${style}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      loadConfig()
    } catch (error) {
      setError('Failed to upload font')
    }
  }

  const handleLogoUpload = async (file) => {
    try {
      const formData = new FormData()
      formData.append('logo', file)
      await axios.post('/api/branding/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      loadConfig()
    } catch (error) {
      setError('Failed to upload logo')
    }
  }

  const generatePreview = async () => {
    try {
      const response = await axios.get('/api/bills/preview', {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      setPreview(url)
    } catch (error) {
      setError('Failed to generate preview')
    }
  }

  if (loading) return <div className="p-6 dark:bg-slate-900 dark:text-gray-300">Loading...</div>
  if (error) return <div className="p-6 text-red-500 dark:bg-slate-900">{error}</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Branding Configuration</h2>
      
      {/* Colors */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config.colors).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 capitalize">
                {key} Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="flex-1 px-3 py-2 border rounded"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Fonts</h3>
        <div className="grid grid-cols-2 gap-4">
          {['primary', 'secondary'].map((type) => (
            <div key={type}>
              <h4 className="font-medium mb-2 capitalize">{type} Font</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm mb-1">Regular</label>
                  <input
                    type="file"
                    accept=".ttf,.otf"
                    onChange={(e) => handleFontUpload(type, 'regular', e.target.files[0])}
                    className="hidden"
                    id={`${type}-regular`}
                  />
                  <label
                    htmlFor={`${type}-regular`}
                    className="flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <DocumentArrowUpIcon className="h-5 w-5" />
                    Upload Regular Font
                  </label>
                </div>
                <div>
                  <label className="block text-sm mb-1">Bold</label>
                  <input
                    type="file"
                    accept=".ttf,.otf"
                    onChange={(e) => handleFontUpload(type, 'bold', e.target.files[0])}
                    className="hidden"
                    id={`${type}-bold`}
                  />
                  <label
                    htmlFor={`${type}-bold`}
                    className="flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <DocumentArrowUpIcon className="h-5 w-5" />
                    Upload Bold Font
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Logo</h3>
        <div>
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={(e) => handleLogoUpload(e.target.files[0])}
            className="hidden"
            id="logo-upload"
          />
          <label
            htmlFor="logo-upload"
            className="flex items-center gap-2 px-4 py-2 border rounded cursor-pointer hover:bg-gray-50"
          >
            <PhotoIcon className="h-5 w-5" />
            Upload Logo
          </label>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Preview</h3>
        <button
          onClick={generatePreview}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Generate Preview
        </button>
        {preview && (
          <div className="mt-4">
            <iframe
              src={preview}
              className="w-full h-[600px] border rounded"
              title="PDF Preview"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default BrandingManager 