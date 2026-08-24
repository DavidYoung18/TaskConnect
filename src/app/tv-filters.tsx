import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TV_COUNT_OPTIONS = ['1', '2', '3', '4', '5'];
const WALL_MATERIAL_OPTIONS = [
  { value: 'brick', labelKey: 'tvIntake.wallBrick' },
  { value: 'concrete', labelKey: 'tvIntake.wallConcrete' },
  { value: 'drywall', labelKey: 'tvIntake.wallDrywall' },
  { value: 'foam-block', labelKey: 'tvIntake.wallFoamBlock' },
];

const TOTAL_STEPS = 2;

// Individual providers (like TV mounting) don't ask for an address up front the
// way the cleaning-company intake does — booking-review.tsx already falls back to
// the customer's default saved address for every other per-job category, and this
// follows the same pattern rather than introducing a one-off address step here.
export default function TvIntakeScreen() {
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [tvCount, setTvCount] = useState<string | null>(null);
  const [wallMaterial, setWallMaterial] = useState<string | null>(null);

  const stepValid = [tvCount !== null, wallMaterial !== null][step];

  function handleBack() {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  }

  function handleNext() {
    if (!stepValid) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    const params = [
      'categoryId=tv-mounting',
      `tvCount=${tvCount}`,
      `wallMaterial=${wallMaterial}`,
    ];
    router.push(`/provider-list?${params.join('&')}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('tvIntake.tvCountQuestion')}</Text>
            <View style={styles.pillRow}>
              {TV_COUNT_OPTIONS.map((opt) => {
                const selected = tvCount === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setTvCount(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 1:
        return (
          <View>
            <Text style={styles.sectionLabel}>{t('tvIntake.wallMaterialQuestion')}</Text>
            {WALL_MATERIAL_OPTIONS.map((opt) => {
              const selected = wallMaterial === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => setWallMaterial(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{t(opt.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('tvIntake.title')}</Text>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !stepValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!stepValid}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>
            {step < TOTAL_STEPS - 1 ? t('common.continue') : t('tvIntake.findProviders')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  backButton: {
    padding: 2,
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e8e8e8',
  },
  progressDotActive: {
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  cardSelected: {
    borderColor: '#000000',
    backgroundColor: '#f8f8f8',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  cardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  cardLabelSelected: {
    color: '#000000',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  pillSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  nextButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
