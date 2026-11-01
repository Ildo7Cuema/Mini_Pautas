/** Extrai "Nª Classe" do nome da turma (ex.: "5ª A" ou "7ª Classe B"). */
export function extractClasseFromTurmaNome(turmaName: string): string | null {
    if (!turmaName) return null
    const withLabel = turmaName.match(/(\d+)\s*[ªº]\s*Classe/i)
    if (withLabel) return `${withLabel[1]}ª Classe`
    const short = turmaName.match(/(\d+)\s*[ªº]/i)
    if (short) return `${short[1]}ª Classe`
    return null
}

export function normalizeClasseLabel(classe: string): string {
    const m = classe.match(/(\d+)/)
    return m ? `${m[1]}ª Classe` : classe.trim()
}
