import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'

interface JsonEditorMonacoProps {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (isValid: boolean, error?: string) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  required?: boolean
  className?: string
  height?: number
}

export function JsonEditorMonaco({
  value,
  onChange,
  onValidationChange,
  placeholder: _placeholder = '{ "value": "" }',
  disabled = false,
  label,
  required = false,
  className = '',
  height = 150,
}: JsonEditorMonacoProps) {
  const [isValid, setIsValid] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const validateJson = (jsonString: string) => {
      if (!jsonString.trim()) {
        setIsValid(true)
        setError(null)
        onValidationChange?.(true)
        return
      }

      try {
        JSON.parse(jsonString)
        setIsValid(true)
        setError(null)
        onValidationChange?.(true)
      } catch (e) {
        setIsValid(false)
        const errorMessage = e instanceof Error ? e.message : 'Invalid JSON format'
        setError(errorMessage)
        onValidationChange?.(false, errorMessage)
      }
    }

    validateJson(value)
  }, [value, onValidationChange])

  const handleEditorChange = (newValue: string | undefined) => {
    const val = newValue || ''
    onChange(val)
  }

  return (
    <div className={className}>
      {label && (
        <div className="text-sm font-medium mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </div>
      )}
      <Editor
        height={height}
        defaultLanguage="json"
        value={value}
        onChange={handleEditorChange}
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
          readOnly: disabled,
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
      {!isValid && error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 mt-2">{error}</div>
      )}
      {isValid && (
        <div className="text-xs text-gray-600 mt-2">Valid JSON format. Use {} for objects, [] for arrays.</div>
      )}
    </div>
  )
}
