import React, { useState, useCallback } from "react";
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Share, Clipboard,
  Switch, Keyboard,
} from "react-native";
import * as Speech from "expo-speech";

// ponytail: 10.0.2.2 = host from Android emulator; change for physical device
const API_URL = "http://10.0.2.2:8080/api/translate";
const AUTH = "Basic " + btoa("admin:password123");

const SOURCE_LANGS = ["Auto-Detect", "English", "French", "Spanish", "German", "Turkish", "Arabic (MSA)"];
const TARGET_LANGS = ["Darija", "English", "French", "Spanish", "Arabic (MSA)"];

export default function App() {
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [transliteration, setTransliteration] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [sourceLang, setSourceLang] = useState("Auto-Detect");
  const [targetLang, setTargetLang] = useState("Darija");
  const [translit, setTranslit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const langValue = (l) => l === "Auto-Detect" ? "auto" : l;

  const doTranslate = useCallback(async () => {
    if (!text.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setTranslation(""); setTransliteration(""); setDetectedLang("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ text, sourceLang: langValue(sourceLang), targetLang, transliterate: translit }),
      });
      const data = await res.json();
      if (data.error) {
        setTranslation("Error: " + data.error);
      } else {
        setTranslation(data.translation || "");
        setTransliteration(data.transliteration || "");
        setDetectedLang(data.detectedLang || "");
        setHistory(h => [{
          source: text, translation: data.translation, transliteration: data.transliteration || "",
          lang: data.detectedLang || sourceLang, time: new Date().toLocaleTimeString(),
        }, ...h.slice(0, 29)]);
      }
    } catch (e) {
      Alert.alert("Connection Error", "Is the server running?\n" + e.message);
    } finally {
      setLoading(false);
    }
  }, [text, sourceLang, targetLang, translit]);

  const speakTranslation = () => {
    if (!translation) return;
    Speech.speak(translation, { language: targetLang === "Darija" ? "ar" : targetLang === "French" ? "fr" : "en", rate: 0.85 });
  };

  const shareTranslation = async () => {
    if (!translation) return;
    let msg = translation;
    if (transliteration) msg += "\n(" + transliteration + ")";
    try { await Share.share({ message: msg }); } catch {}
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = await Clipboard.getString();
      if (clip) { setText(clip); }
    } catch {}
  };

  const copyTranslation = () => {
    if (!translation) return;
    let msg = translation;
    if (transliteration) msg += "\n(" + transliteration + ")";
    Clipboard.setString(msg);
    Alert.alert("Copied", "Translation copied to clipboard");
  };

  const swapLangs = () => {
    if (sourceLang === "Auto-Detect") return;
    if (TARGET_LANGS.includes(sourceLang) && SOURCE_LANGS.includes(targetLang)) {
      const s = targetLang, t = sourceLang;
      setSourceLang(s); setTargetLang(t);
    }
    if (translation) { setText(translation); setTranslation(""); setTransliteration(""); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Darija Translator</Text>
          <Text style={styles.headerSub}>Moroccan Arabic Dialect</Text>
        </View>

        <View style={styles.card}>
          {/* Source lang chips */}
          <Text style={styles.label}>FROM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.langRow}>
              {SOURCE_LANGS.map(lang => (
                <TouchableOpacity key={lang} style={[styles.langChip, sourceLang === lang && styles.langChipActive]} onPress={() => setSourceLang(lang)}>
                  <Text style={[styles.langChipText, sourceLang === lang && styles.langChipTextActive]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Target lang chips */}
          <Text style={styles.label}>TO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.langRow}>
              {TARGET_LANGS.map(lang => (
                <TouchableOpacity key={lang} style={[styles.langChip, targetLang === lang && styles.langChipActive]} onPress={() => setTargetLang(lang)}>
                  <Text style={[styles.langChipText, targetLang === lang && styles.langChipTextActive]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Transliteration toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Latin transliteration</Text>
            <Switch value={translit} onValueChange={setTranslit} trackColor={{ true: "#16a34a" }} thumbColor="#fff" />
          </View>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput style={styles.input} multiline placeholder="Enter text..." placeholderTextColor="#aaa" value={text} onChangeText={setText} />
            <TouchableOpacity style={styles.pasteBtn} onPress={pasteFromClipboard}>
              <Text style={styles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.charCount}>{text.length} chars</Text>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={doTranslate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Translate</Text>}
          </TouchableOpacity>

          {translation ? (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>TRANSLATION</Text>
              <View style={styles.outputBox}>
                <Text style={styles.outputText}>{translation}</Text>
              </View>
              {transliteration ? (
                <View style={styles.translitBox}>
                  <Text style={styles.translitText}>{transliteration}</Text>
                </View>
              ) : null}
              {detectedLang ? <Text style={styles.detected}>Detected: {detectedLang}</Text> : null}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={speakTranslation}>
                  <Text style={styles.actionBtnText}>🔊 Read</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={copyTranslation}>
                  <Text style={styles.actionBtnText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={shareTranslation}>
                  <Text style={styles.actionBtnText}>📤 Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={swapLangs}>
                  <Text style={styles.actionBtnText}>⇄ Swap</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>RECENT TRANSLATIONS</Text>
            {history.map((h, i) => (
              <TouchableOpacity key={i} style={styles.historyItem} onPress={() => { setText(h.source); setTranslation(h.translation); setTransliteration(h.transliteration || ""); }}>
                <Text style={styles.histSrc} numberOfLines={1}>{h.source}</Text>
                <Text style={styles.histTrl} numberOfLines={1}>{h.translation}</Text>
                {h.transliteration ? <Text style={styles.histTranslit} numberOfLines={1}>({h.transliteration})</Text> : null}
                <Text style={styles.histMeta}>{h.lang} → {targetLang} · {h.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function btoa(str) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i), b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0, c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += chars[a >> 2] + chars[((a & 3) << 4) | (b >> 4)];
    output += i + 1 < str.length ? chars[((b & 15) << 2) | (c >> 6)] : "=";
    output += i + 2 < str.length ? chars[c & 63] : "=";
  }
  return output;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#16a34a" },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#16a34a", padding: 24, paddingBottom: 18 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 2 },
  card: { backgroundColor: "#fff", margin: 14, marginBottom: 0, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#e5e7eb" },
  label: { fontSize: 10, fontWeight: "700", color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" },
  langRow: { flexDirection: "row", gap: 6 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  langChipActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  langChipText: { fontSize: 12, color: "#6b7280" },
  langChipTextActive: { color: "#fff", fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  toggleLabel: { fontSize: 13, color: "#6b7280" },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  input: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: "top" },
  pasteBtn: { backgroundColor: "#f3f4f6", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  pasteBtnText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  charCount: { fontSize: 10, color: "#9ca3af", textAlign: "right", marginTop: 2, marginBottom: 8 },
  btn: { backgroundColor: "#16a34a", borderRadius: 10, padding: 14, alignItems: "center" },
  btnDisabled: { backgroundColor: "#9ca3af" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  outputBox: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#dcfce7", borderRadius: 10, padding: 14, minHeight: 50 },
  outputText: { fontSize: 17, lineHeight: 26, textAlign: "right", writingDirection: "rtl" },
  translitBox: { backgroundColor: "#f3f4f6", borderRadius: 8, padding: 10, marginTop: 6 },
  translitText: { fontSize: 14, color: "#6b7280", fontStyle: "italic" },
  detected: { fontSize: 12, color: "#16a34a", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  actionBtn: { flex: 1, minWidth: 70, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  actionBtnText: { fontSize: 12, color: "#16a34a", fontWeight: "500" },
  historyItem: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 8 },
  histSrc: { fontSize: 13, color: "#6b7280" },
  histTrl: { fontSize: 14, textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  histTranslit: { fontSize: 11, color: "#9ca3af", fontStyle: "italic", marginTop: 1 },
  histMeta: { fontSize: 10, color: "#9ca3af", marginTop: 2 },
});
