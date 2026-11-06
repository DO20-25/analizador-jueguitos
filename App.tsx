import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GLView } from "expo-gl";
import * as Device from "expo-device";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import {
  compareRequirements,
  type DeviceCapabilities,
  type RequirementComparison,
  type RequirementStatus,
} from "./src/analyzer";
import type { GameRecord, GameRequest } from "./src/database.types";
import { supabase, supabaseConfigured } from "./src/supabase";

const initialDevice: DeviceCapabilities = {
  osName: Platform.OS === "ios" ? "iOS" : "Android",
  osVersion: Device.osVersion ?? "No disponible",
  platformApiLevel: Device.platformApiLevel,
  totalRamGb: Device.totalMemory ? Device.totalMemory / 1024 ** 3 : null,
  graphicsName: null,
  modelName: Device.modelName ?? "No disponible",
  processorName: "No disponible en Expo Go",
  supportedAbis: Device.supportedCpuArchitectures ?? [],
};

function statusLabel(status: RequirementStatus): string {
  switch (status) {
    case "meets":
      return "✓ Cumple";
    case "does-not-meet":
      return "✗ No cumple";
    default:
      return "— Sin datos comparables";
  }
}

function formatPercentage(value: number): string {
  return Math.abs(value).toFixed(1);
}

function RequirementField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "decimal-pad" | "url";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
        keyboardType={keyboardType ?? "default"}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#78869a"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ComparisonRow({ item }: { item: RequirementComparison }) {
  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonColumn}>
        <Text style={styles.rowLabel}>{item.name}</Text>
        <Text style={styles.rowValue}>{item.recommended}</Text>
      </View>
      <View style={styles.comparisonColumn}>
        <Text style={styles.rowLabel}>Tu equipo</Text>
        <Text style={styles.rowValue}>{item.device}</Text>
      </View>
      <Text
        accessibilityLabel={statusLabel(item.status)}
        style={[
          styles.status,
          item.status === "meets" && styles.statusGood,
          item.status === "does-not-meet" && styles.statusBad,
        ]}
      >
        {item.status === "meets"
          ? "✓"
          : item.status === "does-not-meet"
            ? "✗"
            : "—"}
      </Text>
    </View>
  );
}

function DeviceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.deviceRow}>
      <Text style={styles.deviceLabel}>{label}</Text>
      <Text style={styles.deviceValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const [gameName, setGameName] = useState("");
  const [minimumOs, setMinimumOs] = useState("");
  const [recommendedRam, setRecommendedRam] = useState("");
  const [minimumOpenGles, setMinimumOpenGles] = useState("");
  const [processorRequirement, setProcessorRequirement] = useState("");
  const [graphicsRequirement, setGraphicsRequirement] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [device, setDevice] = useState(initialDevice);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysis, setAnalysis] = useState<{
    gameName: string;
    sourceUrl: string;
    comparisons: RequirementComparison[];
  } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [catalog, setCatalog] = useState<GameRecord[]>([]);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [adminRefresh, setAdminRefresh] = useState(0);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage("");
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }
        if (error) {
          setAuthMessage(`No se pudo restaurar la sesión: ${error.message}`);
          return;
        }
        setSession(data.session);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthMessage(
            `No se pudo restaurar la sesión: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    setCatalogLoading(true);
    setCatalogMessage("");
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("game_catalog")
          .select("*")
          .eq("platform", platform)
          .order("game_name")
          .limit(50);
        if (!active) {
          return;
        }
        if (error) {
          setCatalogMessage(`No se pudo cargar el catálogo: ${error.message}`);
          setCatalog([]);
          return;
        }
        setCatalog(data);
      } catch (error: unknown) {
        if (active) {
          setCatalogMessage(
            `No se pudo cargar el catálogo: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [platform, catalogRefresh]);

  useEffect(() => {
    if (!supabase || !session) {
      setIsAdmin(false);
      setRequests([]);
      setAdminMessage("");
      return;
    }

    let active = true;
    const client = supabase;
    const userId = session.user.id;
    async function loadAdminQueue() {
      setAdminMessage("");
      const { data: adminRecord, error: adminError } = await client
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }
      if (adminError) {
        setIsAdmin(false);
        setAdminMessage(`No se pudo verificar el acceso: ${adminError.message}`);
        return;
      }

      const administrator = adminRecord !== null;
      setIsAdmin(administrator);
      if (!administrator) {
        setRequests([]);
        return;
      }

      const { data, error } = await client
        .from("game_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!active) {
        return;
      }
      if (error) {
        setAdminMessage(`No se pudieron cargar las solicitudes: ${error.message}`);
        setRequests([]);
        return;
      }
      setRequests(data);
    }

    loadAdminQueue().catch((error: unknown) => {
      if (active) {
        setAdminMessage(
          `No se pudo cargar la bandeja: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    return () => {
      active = false;
    };
  }, [session, adminRefresh]);

  const detectedRam = device.totalRamGb
    ? `${device.totalRamGb.toFixed(1)} GB`
    : "No disponible";
  const detectedAbi = device.supportedAbis.slice(0, 3).join(", ") || "No disponible";

  const comparisons = analysis?.comparisons ?? [];

  function analyze() {
    const ram = recommendedRam.trim().replace(",", ".");
    const parsedRam = ram ? Number(ram) : undefined;
    const versionPattern = /^\d+(?:\.\d+)*$/;

    if (!gameName.trim()) {
      setErrorMessage("Escribe el nombre del juego.");
      setAnalysis(null);
      return;
    }
    if (minimumOs.trim() && !versionPattern.test(minimumOs.trim())) {
      setErrorMessage("El formato del sistema debe ser numérico, por ejemplo 10.0.");
      setAnalysis(null);
      return;
    }
    if (ram && (!Number.isFinite(parsedRam) || (parsedRam ?? 0) <= 0)) {
      setErrorMessage("La RAM debe ser un número mayor que cero.");
      setAnalysis(null);
      return;
    }
    if (minimumOpenGles.trim() && !versionPattern.test(minimumOpenGles.trim())) {
      setErrorMessage("El formato de OpenGL ES debe ser numérico, por ejemplo 3.2.");
      setAnalysis(null);
      return;
    }
    if (
      !minimumOs.trim() &&
      !ram &&
      !minimumOpenGles.trim() &&
      !processorRequirement.trim() &&
      !graphicsRequirement.trim()
    ) {
      setErrorMessage("Ingresa al menos un requisito del juego para comparar.");
      setAnalysis(null);
      return;
    }

    setErrorMessage("");
    setAnalysis({
      gameName: gameName.trim(),
      sourceUrl: sourceUrl.trim(),
      comparisons: compareRequirements(
        {
          gameName: gameName.trim(),
          minimumOsVersion: minimumOs.trim() || undefined,
          recommendedRamGb: parsedRam,
          minimumOpenGlesVersion: minimumOpenGles.trim() || undefined,
          processorRequirement: processorRequirement.trim() || undefined,
          graphicsRequirement: graphicsRequirement.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
        },
        device,
      ),
    });
  }

  async function handleAuthentication() {
    if (!supabase) {
      setAuthMessage("Configura las variables de Supabase para habilitar las cuentas.");
      return;
    }
    if (!email.trim() || !password) {
      setAuthMessage("Escribe tu correo y contraseña.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    try {
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
            })
          : await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

      if (result.error) {
        setAuthMessage(`No se pudo iniciar sesión: ${result.error.message}`);
      } else if (authMode === "signup" && !result.data.session) {
        setAuthMessage("Cuenta creada. Revisa tu correo para confirmar el registro.");
      } else {
        setSession(result.data.session);
        setAuthMessage(
          authMode === "signup" ? "Cuenta creada correctamente." : "Sesión iniciada.",
        );
        setPassword("");
      }
    } catch (error: unknown) {
      setAuthMessage(
        `No se pudo completar la autenticación: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthMessage(`No se pudo cerrar la sesión: ${error.message}`);
        return;
      }
      setSession(null);
      setAuthMessage("Sesión cerrada.");
    } catch (error: unknown) {
      setAuthMessage(
        `No se pudo cerrar la sesión: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function selectCatalogGame(game: GameRecord) {
    setGameName(game.game_name);
    setMinimumOs(game.minimum_os_version ?? "");
    setRecommendedRam(
      game.recommended_ram_gb != null ? String(game.recommended_ram_gb) : "",
    );
    setMinimumOpenGles(game.minimum_opengles_version ?? "");
    setProcessorRequirement(game.processor_requirement ?? "");
    setGraphicsRequirement(game.graphics_requirement ?? "");
    setSourceUrl(game.source_url ?? "");
    setErrorMessage("");
    setRequestMessage("");
  }

  async function submitGameRequest() {
    if (!supabase || !session) {
      setRequestMessage("Inicia sesión para enviar una solicitud de revisión.");
      return;
    }

    const normalizedRam = recommendedRam.trim().replace(",", ".");
    const parsedRam = normalizedRam ? Number(normalizedRam) : null;
    const versionPattern = /^\d+(?:\.\d+)*$/;
    if (!gameName.trim()) {
      setRequestMessage("Escribe el nombre del juego antes de enviar la solicitud.");
      return;
    }
    if (
      normalizedRam &&
      (!Number.isFinite(parsedRam) || (parsedRam ?? 0) <= 0)
    ) {
      setRequestMessage("La RAM debe ser un número mayor que cero.");
      return;
    }
    if (
      (minimumOs.trim() && !versionPattern.test(minimumOs.trim())) ||
      (minimumOpenGles.trim() && !versionPattern.test(minimumOpenGles.trim()))
    ) {
      setRequestMessage("Revisa el formato numérico de las versiones.");
      return;
    }
    if (
      !minimumOs.trim() &&
      !normalizedRam &&
      !minimumOpenGles.trim() &&
      !processorRequirement.trim() &&
      !graphicsRequirement.trim()
    ) {
      setRequestMessage("Incluye al menos un requisito para enviar la solicitud.");
      return;
    }

    setRequestLoading(true);
    setRequestMessage("");
    try {
      const { error } = await supabase.from("game_requests").insert({
        user_id: session.user.id,
        game_name: gameName.trim(),
        platform,
        minimum_os_version: minimumOs.trim() || null,
        recommended_ram_gb: parsedRam,
        minimum_opengles_version: minimumOpenGles.trim() || null,
        processor_requirement: processorRequirement.trim() || null,
        graphics_requirement: graphicsRequirement.trim() || null,
        source_url: sourceUrl.trim() || null,
      });
      setRequestMessage(
        error
          ? `No se pudo enviar la solicitud: ${error.message}`
          : "Solicitud enviada. Un administrador revisará los requisitos.",
      );
    } catch (error: unknown) {
      setRequestMessage(
        `No se pudo enviar la solicitud: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setRequestLoading(false);
    }
  }

  async function reviewGameRequest(request: GameRequest, approve: boolean) {
    if (!supabase) {
      return;
    }
    setAdminMessage("");
    try {
      const { error } = approve
        ? await supabase.rpc("approve_game_request", {
            p_request_id: request.id,
          })
        : await supabase.rpc("reject_game_request", {
            p_request_id: request.id,
          });
      if (error) {
        setAdminMessage(`No se pudo revisar la solicitud: ${error.message}`);
        return;
      }
      setAdminRefresh((current) => current + 1);
      if (approve) {
        setCatalogRefresh((current) => current + 1);
      }
    } catch (error: unknown) {
      setAdminMessage(
        `No se pudo revisar la solicitud: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  function onGlContextCreate(gl: {
    VERSION: number;
    RENDERER: number;
    getParameter: (parameter: number) => unknown;
    endFrameEXP: () => void;
  }) {
    const version = String(gl.getParameter(gl.VERSION));
    const openGlesVersion = version.match(/OpenGL ES\s+([\d.]+)/i)?.[1] ?? null;
    const graphicsName = String(gl.getParameter(gl.RENDERER));
    setDevice((current) => ({
      ...current,
      openGlesVersion,
      graphicsName: graphicsName || null,
    }));
    gl.endFrameEXP();
  }

  const ramComparison = comparisons.find((item) => item.name === "Memoria RAM");

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Analizador de equipo</Text>
        <Text style={styles.subtitle}>
          Compara tu teléfono con los requisitos recomendados, sin descargar el juego.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Catálogo de juegos</Text>
          <Text style={styles.helper}>
            Consulta requisitos revisados para {platform === "ios" ? "iOS" : "Android"}.
            Selecciona un juego para cargar sus datos en el análisis.
          </Text>
          {!supabaseConfigured ? (
            <Text style={styles.helper}>
              El catálogo en línea estará disponible después de configurar Supabase.
            </Text>
          ) : catalogLoading ? (
            <Text style={styles.helper}>Cargando catálogo...</Text>
          ) : catalogMessage ? (
            <Text style={styles.error}>{catalogMessage}</Text>
          ) : catalog.length === 0 ? (
            <Text style={styles.helper}>Aún no hay juegos publicados para esta plataforma.</Text>
          ) : (
            catalog.map((game) => (
              <Pressable
                accessibilityRole="button"
                key={game.id}
                onPress={() => selectCatalogGame(game)}
                style={styles.catalogItem}
              >
                <Text style={styles.catalogName}>{game.game_name}</Text>
                <Text style={styles.helper}>
                  {[
                    game.minimum_os_version
                      ? `SO ${game.minimum_os_version}+`
                      : null,
                    game.recommended_ram_gb != null
                      ? `${game.recommended_ram_gb} GB RAM`
                      : null,
                    game.minimum_opengles_version
                      ? `OpenGL ES ${game.minimum_opengles_version}+`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Requisitos parciales"}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cuenta y solicitudes</Text>
          {!supabaseConfigured ? (
            <Text style={styles.helper}>
              Puedes analizar manualmente sin cuenta. Para enviar solicitudes o administrar
              el catálogo, configura las credenciales de Supabase.
            </Text>
          ) : session ? (
            <>
              <Text style={styles.helper}>
                Sesión iniciada como {session.user.email ?? "usuario"}.
                {isAdmin ? " Cuenta administrativa." : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={authLoading}
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {authLoading ? "Procesando..." : "Cerrar sesión"}
                </Text>
              </Pressable>
              {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.helper}>
                Iniciar sesión es opcional para consultar y analizar. Se requiere una cuenta
                para enviar solicitudes de revisión.
              </Text>
              <TextInput
                accessibilityLabel="Correo electrónico"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Correo electrónico"
                placeholderTextColor="#78869a"
                style={styles.input}
                value={email}
              />
              <TextInput
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoComplete={authMode === "signup" ? "new-password" : "password"}
                onChangeText={setPassword}
                placeholder="Contraseña"
                placeholderTextColor="#78869a"
                secureTextEntry
                style={styles.input}
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                disabled={authLoading}
                onPress={handleAuthentication}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>
                  {authLoading
                    ? "Procesando..."
                    : authMode === "signup"
                      ? "Crear cuenta"
                      : "Iniciar sesión"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setAuthMode((current) =>
                    current === "signin" ? "signup" : "signin",
                  )
                }
              >
                <Text style={styles.linkText}>
                  {authMode === "signin"
                    ? "¿No tienes cuenta? Regístrate"
                    : "¿Ya tienes cuenta? Inicia sesión"}
                </Text>
              </Pressable>
              {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
            </>
          )}
          {session && !isAdmin ? (
            <>
              <Text style={styles.helper}>
                Completa los requisitos del formulario y envía la solicitud desde el final
                de esa sección para que el equipo administrativo la revise.
              </Text>
            </>
          ) : null}
          {session && isAdmin ? (
            <View style={styles.adminQueue}>
              <Text style={styles.sectionTitle}>
                Solicitudes pendientes ({requests.length})
              </Text>
              {adminMessage ? <Text style={styles.error}>{adminMessage}</Text> : null}
              {requests.length === 0 && !adminMessage ? (
                <Text style={styles.helper}>No hay solicitudes pendientes.</Text>
              ) : null}
              {requests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  <Text style={styles.catalogName}>
                    {request.game_name} · {request.platform.toUpperCase()}
                  </Text>
                  <Text style={styles.helper}>
                    {[
                      request.minimum_os_version
                        ? `SO ${request.minimum_os_version}+`
                        : null,
                      request.recommended_ram_gb != null
                        ? `${request.recommended_ram_gb} GB RAM`
                        : null,
                      request.minimum_opengles_version
                        ? `OpenGL ES ${request.minimum_opengles_version}+`
                        : null,
                      request.processor_requirement,
                      request.graphics_requirement,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin requisitos especificados"}
                  </Text>
                  {request.source_url ? (
                    <Text style={styles.helper}>Fuente: {request.source_url}</Text>
                  ) : null}
                  <View style={styles.reviewButtons}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => reviewGameRequest(request, true)}
                      style={styles.approveButton}
                    >
                      <Text style={styles.reviewButtonText}>Aprobar y publicar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => reviewGameRequest(request, false)}
                      style={styles.rejectButton}
                    >
                      <Text style={styles.reviewButtonText}>Rechazar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {session && adminMessage && !isAdmin ? (
            <Text style={styles.error}>{adminMessage}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Requisitos recomendados</Text>
          <Text style={styles.helper}>
            Transcribe los datos publicados por la tienda o el sitio oficial.
          </Text>
          <RequirementField
            label="Nombre del juego"
            value={gameName}
            onChangeText={setGameName}
          />
          <RequirementField
            label={`Versión mínima de ${device.osName} (p. ej. 10.0)`}
            value={minimumOs}
            onChangeText={setMinimumOs}
          />
          <RequirementField
            label="RAM recomendada en GB (p. ej. 6)"
            value={recommendedRam}
            onChangeText={setRecommendedRam}
            keyboardType="decimal-pad"
          />
          <RequirementField
            label="OpenGL ES mínimo (opcional, p. ej. 3.2)"
            value={minimumOpenGles}
            onChangeText={setMinimumOpenGles}
          />
          <RequirementField
            label="Procesador recomendado (opcional)"
            value={processorRequirement}
            onChangeText={setProcessorRequirement}
          />
          <RequirementField
            label="Gráficos recomendados (opcional)"
            value={graphicsRequirement}
            onChangeText={setGraphicsRequirement}
          />
          <RequirementField
            label="Enlace de la fuente oficial (opcional)"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            keyboardType="url"
          />
          <Pressable
            accessibilityRole="button"
            onPress={analyze}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Analizar equipo</Text>
          </Pressable>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {session && !isAdmin ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={requestLoading}
                onPress={submitGameRequest}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {requestLoading ? "Enviando..." : "Solicitar revisión del juego"}
                </Text>
              </Pressable>
              {requestMessage ? (
                <Text
                  style={
                    requestMessage.startsWith("No se pudo") ||
                    requestMessage.startsWith("Escribe") ||
                    requestMessage.startsWith("Revisa") ||
                    requestMessage.startsWith("Incluye")
                      ? styles.error
                      : styles.helper
                  }
                >
                  {requestMessage}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {analysis ? (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Comparación: {analysis.gameName}</Text>
            <View style={styles.comparisonHeader}>
              <Text style={styles.headerColumn}>Recomendado</Text>
              <Text style={styles.headerColumn}>Tu equipo</Text>
              <Text style={styles.headerStatus}>Resultado</Text>
            </View>
            {analysis.sourceUrl ? (
              <Text style={styles.source}>Fuente declarada: {analysis.sourceUrl}</Text>
            ) : null}
            {analysis.comparisons.map((item) => (
              <ComparisonRow key={item.name} item={item} />
            ))}
            {ramComparison?.percentageDifference != null ? (
              <Text style={styles.ramDifference}>
                {ramComparison.percentageDifference === 0
                  ? "La RAM es igual a la recomendada."
                  : `${formatPercentage(ramComparison.percentageDifference)}% ${
                      ramComparison.percentageDifference > 0 ? "más" : "menos"
                    } RAM que la recomendada.`}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Equipo detectado</Text>
          <DeviceRow label={device.osName} value={device.osVersion} />
          {device.platformApiLevel != null ? (
            <DeviceRow label="API" value={String(device.platformApiLevel)} />
          ) : null}
          <DeviceRow label="RAM total" value={detectedRam} />
          <DeviceRow
            label="OpenGL ES"
            value={device.openGlesVersion ?? "Consultando..."}
          />
          <DeviceRow label="Modelo" value={device.modelName} />
          <DeviceRow label="Procesador" value={device.processorName} />
          <DeviceRow label="GPU" value={device.graphicsName ?? "Consultando..."} />
          <DeviceRow label="Arquitecturas" value={detectedAbi} />
        </View>

        <Text style={styles.disclaimer}>
          Los requisitos del catálogo dependen de la fuente declarada y pueden cambiar.
          El modelo del procesador y los gráficos no certifican compatibilidad por sí
          solos. El porcentaje compara únicamente la RAM y no predice el rendimiento.
        </Text>
        <GLView
          onContextCreate={onGlContextCreate}
          pointerEvents="none"
          style={styles.glProbe}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 64,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    color: "#15233b",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#52627a",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    gap: 11,
    shadowColor: "#15233b",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  resultCard: {
    backgroundColor: "#e9f1ff",
    borderRadius: 18,
    padding: 16,
    gap: 13,
  },
  sectionTitle: {
    color: "#15233b",
    fontSize: 19,
    fontWeight: "700",
  },
  helper: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 5,
  },
  label: {
    color: "#40516b",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: 46,
    borderColor: "#d7dfeb",
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#15233b",
    backgroundColor: "#ffffff",
    fontSize: 15,
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#315ee8",
    paddingVertical: 14,
  },
  buttonPressed: {
    backgroundColor: "#244ac3",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 12,
    borderColor: "#315ee8",
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryButtonPressed: {
    backgroundColor: "#edf2ff",
  },
  secondaryButtonText: {
    color: "#315ee8",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkText: {
    color: "#315ee8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  catalogItem: {
    borderTopColor: "#edf0f5",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 10,
  },
  catalogName: {
    color: "#15233b",
    fontSize: 15,
    fontWeight: "700",
  },
  adminQueue: {
    gap: 11,
    marginTop: 4,
  },
  requestItem: {
    borderTopColor: "#edf0f5",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingTop: 12,
  },
  reviewButtons: {
    flexDirection: "row",
    gap: 8,
  },
  approveButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#168447",
    paddingVertical: 11,
  },
  rejectButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#b42318",
    paddingVertical: 11,
  },
  reviewButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  error: {
    color: "#b42318",
    fontSize: 14,
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerColumn: {
    flex: 1,
    color: "#43516a",
    fontSize: 12,
    fontWeight: "700",
  },
  headerStatus: {
    width: 55,
    color: "#43516a",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopColor: "#d3def2",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  comparisonColumn: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  rowValue: {
    color: "#15233b",
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    width: 55,
    color: "#65748a",
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  statusGood: {
    color: "#168447",
  },
  statusBad: {
    color: "#c83232",
  },
  source: {
    color: "#52627a",
    fontSize: 12,
    lineHeight: 17,
  },
  ramDifference: {
    color: "#15233b",
    fontSize: 14,
    fontWeight: "700",
  },
  deviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopColor: "#edf0f5",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
  },
  deviceLabel: {
    color: "#40516b",
    fontSize: 14,
    fontWeight: "600",
  },
  deviceValue: {
    flexShrink: 1,
    color: "#40516b",
    fontSize: 14,
    textAlign: "right",
  },
  disclaimer: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  glProbe: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
