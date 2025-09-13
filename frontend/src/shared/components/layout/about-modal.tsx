import { Code, Cpu, Globe, Heart, Info } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'

interface BuildInfo {
  release_id: string
  built_at: string
  frontend_version: string
  backend_version: string
}

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
  buildInfo: BuildInfo | null
}

export function AboutModal({ isOpen, onClose, buildInfo }: AboutModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg sm:max-w-xl lg:max-w-2xl max-h-[85vh] border-0 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <Info className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            About WeDX
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Agentic Coding Platform with Semantic Kernel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          {/* Company Section */}
          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-3 sm:p-4 border border-white/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-orange-400 to-pink-500 rounded-md">
                <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Made in Hawaii</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Developed by{' '}
              <span className="font-semibold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                Motojin Investment
              </span>{' '}
              from Hawaii 🌺
            </p>
          </div>

          {/* Technology Section */}
          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-3 sm:p-4 border border-white/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md">
                <Cpu className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">
                Agentic Coding Platform
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
              AI-powered platform with Microsoft Semantic Kernel for intelligent code generation and enterprise
              customization.
            </p>
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                Semantic Kernel
              </span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                FastAPI
              </span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                React TypeScript
              </span>
            </div>
          </div>

          {/* License & Open Source */}
          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-3 sm:p-4 border border-white/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md">
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">
                Open Source & Enterprise
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="font-semibold text-green-600 dark:text-green-400">MIT License</span> with enterprise
              customization and support services.
            </p>
          </div>

          {/* Version Information */}
          {buildInfo && (
            <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-3 sm:p-4 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-gradient-to-br from-slate-500 to-gray-600 rounded-md">
                  <Code className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Version Info</h3>
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Release:</span>
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{buildInfo.release_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Frontend:</span>
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                    {buildInfo.frontend_version}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Backend:</span>
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                    {buildInfo.backend_version}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Built:</span>
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                    {buildInfo.built_at !== 'unknown' ? new Date(buildInfo.built_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="text-center pt-3 pb-2">
          <Button
            onClick={onClose}
            className="px-6 py-2 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
