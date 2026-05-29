// Declare CSS module imports for TypeScript
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
