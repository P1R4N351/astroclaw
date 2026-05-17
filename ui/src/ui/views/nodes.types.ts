export type NodesProps = {
  loading: boolean;
  nodes: Array<Record<string, unknown>>;
  onRefresh: () => void;
};
