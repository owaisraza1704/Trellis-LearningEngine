export function sourceOriginLabel(kind?: string) {
  switch (kind) {
    case 'upload':
      return 'Uploaded file'
    case 'url':
      return 'Added URL'
    case 'text':
      return 'Pasted text'
    case 'web':
      return 'Discovered on the web'
    default:
      return 'Source'
  }
}
