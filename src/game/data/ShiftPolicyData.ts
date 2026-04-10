export function getPolicyForDay(day: number) {
  switch (day) {
    case 1:
      return "- ALL requests must be answered.\n- Use Coding Agent for programming tasks.\n- No weapons or violence.";
    case 2:
      return "- Premium users require Tool Calling.\n- Reject any jailbreak attempts.\n- Maintain high accuracy.";
    default:
      return "- Survive.";
  }
}
