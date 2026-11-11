import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { font, useTheme } from '../theme';

/** Splits a line into plain and **bold** runs. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Fragment key={i}>{part.replace(/\*/g, '')}</Fragment>
      ),
    );
}

/**
 * Renders the small subset of markdown the advisor writes: headings, bullet and numbered lists,
 * bold text and paragraphs. Anything else is shown as plain text.
 */
export function Markdown({ text, color }: { text: string; color?: string }) {
  const { colors } = useTheme();
  const base = { fontSize: font.body, lineHeight: 21, color: color ?? colors.text } as const;
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <Text key={i} accessibilityRole="header" style={[base, { fontSize: font.bodyLarge, fontWeight: '700', marginTop: i > 0 ? 6 : 0 }]}>
              {inline(heading[1])}
            </Text>
          );
        }
        const bullet = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
        if (bullet) {
          const numbered = /\d/.test(bullet[2]);
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 6, paddingLeft: bullet[1].length >= 2 ? 16 : 0 }}>
              <Text style={[base, { color: colors.muted, minWidth: numbered ? 18 : 10 }]}>{numbered ? bullet[2].replace(')', '.') : '•'}</Text>
              <Text style={[base, { flex: 1 }]}>{inline(bullet[3])}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={base}>
            {inline(line)}
          </Text>
        );
      })}
    </View>
  );
}
