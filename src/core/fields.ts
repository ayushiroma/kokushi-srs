/**
 * 分野の分類軸。QB（クエスチョン・バンク）の章立てに合わせてある。
 *
 * あゆさんも同級生もこの区切りで頭が整理されているため、独自分類を作らない。
 * 「成人看護学」を臓器別に割ってあるのが要点で、これが無いと弱点ビューの
 * 「模試前に10分で潰す範囲」が広すぎて使えない。
 *
 * QB固有の章番号（A章・C章など）は使わない。分類名だけを借りる。
 */

export const NURSE_FIELDS: readonly string[] = [
  '基礎医学',
  '基礎看護学',
  '成人看護学総論',
  '消化器',
  '肝・胆・膵',
  '循環器',
  '内分泌・代謝',
  '腎・泌尿器',
  '免疫・アレルギー・膠原病',
  '血液・造血器',
  '感染症',
  '呼吸器',
  '脳・神経',
  '運動器',
  '眼',
  '耳鼻咽喉',
  '歯・口腔',
  '皮膚',
  '女性生殖器',
  '老年看護学',
  '小児看護学',
  '母性看護学',
  '精神看護学',
  '地域・在宅看護論',
  '看護の統合と実践',
  '健康支援と社会保障制度',
]

export const PHN_FIELDS: readonly string[] = [
  '公衆衛生看護学概論',
  '公衆衛生看護方法論Ⅰ',
  '公衆衛生看護方法論Ⅱ',
  '対象別公衆衛生看護活動論（母子・成人・高齢者）',
  '対象別公衆衛生看護活動論（精神・障害者・難病・感染症・歯科）',
  '学校保健・産業保健',
  '健康危機管理',
  '公衆衛生看護管理論',
  '疫学',
  '保健統計',
  '保健医療福祉行政論',
]

export const EXAM_LABELS: Readonly<Record<string, string>> = {
  nurse: '看護師',
  phn: '保健師',
}

/** 試験の表示順。ここに無い試験は末尾へ回す */
export const EXAM_ORDER: readonly string[] = ['nurse', 'phn']

export function fieldsOf(exam: string): readonly string[] {
  if (exam === 'nurse') return NURSE_FIELDS
  if (exam === 'phn') return PHN_FIELDS
  return []
}

export function examLabel(exam: string): string {
  return EXAM_LABELS[exam] ?? exam
}
