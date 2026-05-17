export type AstroclawPiCodingAgentSkillSourceAugmentation = never;

declare module "@earendil-works/pi-coding-agent" {
  interface Skill {
    // Astroclaw relies on the source identifier returned by pi skill loaders.
    source: string;
  }
}
