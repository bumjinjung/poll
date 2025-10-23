export interface TwoChoicePollConfig {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
}

const todayPoll: TwoChoicePollConfig = {
  question: "민초 vs 반민초",
  left: { label: "민초", emoji: "🍦" },
  right: { label: "반민초", emoji: "🙅" },
};

export default todayPoll;
