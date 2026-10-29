// Why, by kind of failure
export const WHY = Object.freeze({
  noChat: '캐릭터 채팅이 열려 있지 않음',
  chatGone: '채팅을 찾지 못함',
  chatMoved: '다른 채팅이 열림',
  oocMoved: '보낸 글이 마지막 메시지가 아님',
  blockGone: '배틀 블록을 찾지 못함',
  blockBroken: '배틀 블록 오류',
  unreadable: '저장값을 읽을 수 없음',
  denied: '권한 없음',
  noMainScreen: '메인 화면 권한 없음',
  writeBlocked: '쓰기 막음',
  replying: '응답 생성 중',
  storyOn: '이야기가 이어짐',
  busy: '진행 중인 배틀이 있음',
  inBattle: '배틀 중',
  ironMode: '철인 모드',
  emptyParty: '파티가 비어 있음',
  allFainted: '싸울 수 있는 포켓몬이 없음',
  unresumable: '이어 할 수 없는 판',
  notOpened: '배틀을 아직 다시 열지 않음',
  noRecord: '배틀 기록이 없음',
  parkFailed: '다른 채팅의 배틀을 저장하지 못함',
  notPicture: '그림으로 읽을 수 없음',
  download: '그림이나 소리를 받지 못함',
  aiCall: '보조 모델 호출 실패',
  aiFail: '보조 모델이 실패를 돌려줌',
  aiMany: '답이 여러 개로 옴',
  noBlock: '답에 배틀 블록이 없음',
  badBlock: '배틀 블록을 읽을 수 없음',
  sceneMoved: '장면이 바뀜',
  unknown: '알 수 없는 오류',
});

export const WHAT = Object.freeze({
  open: '배틀을 열지 못했습니다',
  resume: '배틀로 돌아가지 못했습니다',
  retry: '다시 하지 못했습니다',
  discard: '버리지 못했습니다',
  restore: '되살리지 못했습니다',
  send: '못 보냈습니다',
  sendOn: 'AI에게 보내지 못했습니다',
  result: '결과를 적지 못했습니다',
  storyEnd: '이야기 끝 상태를 넣지 못했습니다',
  autosave: '저장하지 못했습니다',
  orientation: '화면 방향을 저장하지 못했습니다',
  record: '이 채팅에 기록하지 못합니다',
  buttons: '버튼을 쓸 수 없습니다',
  settings: '설정을 저장하지 못합니다',
  picture: '그림을 올리지 못했습니다',
  pictureRemove: '그림을 지우지 못했습니다',
  compat: '호환 봇 항목을 감싸지 못했습니다',
  action: '하지 못했습니다',
  screen: '화면을 열지 못했습니다',
  forge: '배틀을 만들지 못했습니다',
});

export const failed = why => Object.assign(new Error(WHY[why] ?? why), { why });

export const refused = words => Object.assign(new Error(words), { why: 'rule', words: String(words).replace(/\.$/, '') });

function whyOf(error) {
  if (typeof error === 'string') return WHY[error] ?? WHY.unknown;
  if (error?.words) return error.words;
  if (WHY[error?.why]) return WHY[error.why];
  const text = String(error?.message ?? error ?? '');
  if (/in progress/i.test(text)) return WHY.replying;
  if (/HTTP|fetch|network|proxy|Failed to load|받지 못/i.test(text)) return WHY.download;
  return WHY.unknown;
}

const isReplying = error => whyOf(error) === WHY.replying;

export const failureLines = (what, error) => [what, `사유: ${whyOf(error)}`];

export const failureText = (what, error) => failureLines(what, error).join('\n');

export const failureNote = (what, error) => ({ text: failureText(what, error), kind: isReplying(error) ? 'info' : 'error' });
