import type { GitFileSnapshot } from '@shared/domain'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export function GitFilesPanel({ files }: { files: GitFileSnapshot[] }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>真实配置文件</CardTitle>
        <CardDescription>只读展示全局配置、身份 profile 和工作区 includeIf 规则。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion className="space-y-2" type="multiple">
          {files.map((file) => (
            <AccordionItem key={file.path} value={file.path}>
              <AccordionTrigger>
                <span>
                  {file.name}
                  <span className="ml-2 font-mono text-[11px] font-normal text-slate-500">
                    {file.path}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="max-h-52 rounded-md bg-slate-50">
                  <pre className="whitespace-pre-wrap p-2.5 text-[11px] text-slate-600">
                    {file.exists ? file.content : '文件不存在，请保存配置后重试。'}
                  </pre>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
