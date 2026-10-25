/** Recognizes the antibot check Ozon shows instead of its pages. */
export class OzonChallengeParser {
  isChallenge(title: string, body: string): boolean {
    return /antibot|captcha|доступ ограничен|подтвердите,? что вы|проверка безопасности/i.test(
      `${title}\n${body.slice(0, 4000)}`,
    );
  }
}
