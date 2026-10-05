// Stock prose every model reaches for. gameProject.avoidPhrases replaces this list per project; [] turns it off.
export const AVOID_PHRASES=['dust motes','eyes crinkling at the corners','the question hangs in the air','arches an eyebrow','a smile tugging at','didn’t know they were holding','a beat of silence','the air between you','something unreadable','voice barely above a whisper','a shiver down','heart skips a beat'];
export const avoidList=project=>Array.isArray(project?.avoidPhrases)?project.avoidPhrases:AVOID_PHRASES;
