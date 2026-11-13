import { Heading, Text, VStack } from '@astryxdesign/core'

/** ページの見出し・説明文と、ブラウザのタブに出るタイトル */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <VStack gap={1}>
      {/* React 19 では <title> をどこに書いても <head> に入る */}
      <title>{`${title} | tascon`}</title>
      <Heading level={1}>{title}</Heading>
      {description && (
        <Text as="p" color="secondary">
          {description}
        </Text>
      )}
    </VStack>
  )
}
