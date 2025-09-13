import Editor from '@monaco-editor/react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface JsonEditorProps {
  value: unknown
  onChange: (value: unknown) => Promise<void>
  open: boolean
  onClose: () => void
  title?: string
  isLoading?: boolean
}

export function JsonEditor({
  value,
  onChange,
  open,
  onClose,
  title = 'Edit JSON',
  isLoading = false,
}: JsonEditorProps) {
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      try {
        setJsonText(JSON.stringify(value, null, 2))
        setError(null)
        setIsValid(true)
        setIsSaving(false)
      } catch {
        setJsonText('')
        setError('Invalid JSON value')
        setIsValid(false)
        setIsSaving(false)
      }
    }
  }, [value, open])

  const validateJson = (text: string) => {
    try {
      JSON.parse(text)
      setError(null)
      setIsValid(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
      setIsValid(false)
    }
  }

  const handleTextChange = (text: string) => {
    setJsonText(text)
    validateJson(text)
  }

  const handleSave = async () => {
    if (isValid && !isSaving) {
      setIsSaving(true)
      try {
        const parsed = JSON.parse(jsonText)
        await onChange(parsed)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      } finally {
        setIsSaving(false)
      }
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'block' : 'hidden'}`}>
      <button
        className="fixed inset-0 bg-black/50"
        onClick={isLoading || isSaving ? undefined : onClose}
        type="button"
        aria-label="Close dialog"
        disabled={isLoading || isSaving}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <button
            onClick={isLoading || isSaving ? undefined : onClose}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled={isLoading || isSaving}>
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="border rounded-md overflow-hidden">
            <Editor
              height={400}
              defaultLanguage="json"
              value={jsonText}
              onChange={(value) => handleTextChange(value || '')}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: 'on',
                folding: true,
                automaticLayout: true,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
                readOnly: isLoading || isSaving,
                theme: 'vs-light',
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: false,
                renderWhitespace: 'boundary',
                bracketPairColorization: {
                  enabled: true,
                },
              }}
              beforeMount={(monaco) => {
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                  validate: true,
                  allowComments: false,
                  schemas: [],
                  enableSchemaRequest: false,
                })
              }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="text-xs text-gray-600 space-y-1">
            <p>• Use proper JSON syntax with double quotes</p>
            <p>• Strings, numbers, booleans, arrays, and objects are supported</p>
            <p>• Press Ctrl+Shift+F to format JSON automatically</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={isLoading || isSaving ? undefined : onClose}
            disabled={isLoading || isSaving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isLoading || isSaving}
            className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {(isLoading || isSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading || isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
