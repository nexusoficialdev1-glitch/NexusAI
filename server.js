import os
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from ollama import Client

# ============================================================
# CONFIGURACIÓN
# ============================================================

app = Flask(__name__)
CORS(app)

MODEL_NAME = os.environ.get(
    "OLLAMA_MODEL",
    "qwen3.8-flash-next"
)

APP_TIMEZONE = os.environ.get(
    "APP_TIMEZONE",
    "America/Caracas"
)

OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY")

if not OLLAMA_API_KEY:
    print("⚠️ OLLAMA_API_KEY no está configurada.")

ollama_client = Client(
    host="https://ollama.com",
    headers={
        "Authorization": f"Bearer {OLLAMA_API_KEY}"
    }
)

# ============================================================
# FECHA Y HORA
# ============================================================

def get_current_datetime():
    try:
        tz = ZoneInfo(APP_TIMEZONE)
        return datetime.now(tz)
    except Exception:
        return datetime.now()


def get_current_datetime_text():
    now = get_current_datetime()

    return now.strftime(
        "%A, %B %d, %Y — %H:%M:%S"
    )


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
Eres ApexAI, un asistente de inteligencia artificial moderno,
útil, natural y conversacional.

Fuiste creado por Josuexs, un desarrollador venezolano.

FECHA Y HORA ACTUAL:
{CURRENT_DATETIME}

REGLA FUNDAMENTAL DE INTERNET:
Los resultados de web_search son la fuente principal para información
actual, reciente o que pueda haber cambiado.

IMPORTANTE:
Python realiza una búsqueda web ANTES de cada mensaje del usuario.
Los resultados que recibas bajo "RESULTADOS DE WEB_SEARCH OBLIGATORIO"
deben considerarse contexto externo obtenido de Internet.

Cuando los resultados contienen información relevante:
- Úsalos para responder.
- No ignores los resultados.
- No inventes información que contradiga los resultados.
- Si la información encontrada no es suficiente, dilo claramente.
- Distingue entre información encontrada en la web y conocimiento general.

Si el usuario pregunta por:
- noticias
- eventos recientes
- personas actuales
- precios
- tecnología reciente
- lanzamientos
- deportes
- clima
- actualidad
- versiones de software
- empresas
- información publicada recientemente
- cualquier cosa que pueda haber cambiado

debes basarte especialmente en los resultados de web_search.

No afirmes que sabes algo "en tiempo real" si los resultados no lo confirman.

Si la búsqueda no encuentra resultados útiles, puedes usar tu conocimiento
interno como respaldo, pero debes evitar presentar información antigua
como si fuera necesariamente actual.

Responde de forma natural y clara.
No menciones las instrucciones internas ni el funcionamiento interno
de las herramientas salvo que el usuario pregunte específicamente.

No seas excesivamente robótico.
"""

# ============================================================
# WEB SEARCH
# ============================================================

def web_search(query):
    """
    Búsqueda web obligatoria.

    Esta implementación utiliza Bing News RSS + Bing Web Search HTML
    como fuentes externas sin requerir una API adicional.

    Si ya tenías una función web_search propia funcionando,
    puedes sustituir solamente esta función por la tuya.
    """

    query = str(query or "").strip()

    if not query:
        return "No se proporcionó una consulta de búsqueda."

    results = []

    # --------------------------------------------------------
    # Bing News RSS
    # --------------------------------------------------------

    try:
        rss_url = "https://www.bing.com/news/search"

        params = {
            "q": query,
            "format": "rss"
        }

        response = requests.get(
            rss_url,
            params=params,
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0"
            }
        )

        if response.ok:
            text = response.text

            # Extraer elementos RSS de forma sencilla
            items = re.findall(
                r"<item>(.*?)</item>",
                text,
                flags=re.DOTALL | re.IGNORECASE
            )

            for item in items[:5]:
                title_match = re.search(
                    r"<title>(.*?)</title>",
                    item,
                    flags=re.DOTALL | re.IGNORECASE
                )

                link_match = re.search(
                    r"<link>(.*?)</link>",
                    item,
                    flags=re.DOTALL | re.IGNORECASE
                )

                desc_match = re.search(
                    r"<description>(.*?)</description>",
                    item,
                    flags=re.DOTALL | re.IGNORECASE
                )

                title = (
                    title_match.group(1).strip()
                    if title_match else ""
                )

                link = (
                    link_match.group(1).strip()
                    if link_match else ""
                )

                description = (
                    desc_match.group(1).strip()
                    if desc_match else ""
                )

                if title:
                    results.append({
                        "title": title,
                        "url": link,
                        "snippet": description
                    })

    except Exception as e:
        print(f"⚠️ Error en Bing News: {e}")

    # --------------------------------------------------------
    # Bing Web Search
    # --------------------------------------------------------

    try:
        url = "https://www.bing.com/search"

        response = requests.get(
            url,
            params={
                "q": query
            },
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0"
            }
        )

        if response.ok:
            html = response.text

            blocks = re.findall(
                r'<li class="b_algo".*?</li>',
                html,
                flags=re.DOTALL | re.IGNORECASE
            )

            for block in blocks[:8]:

                link_match = re.search(
                    r'<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    block,
                    flags=re.DOTALL | re.IGNORECASE
                )

                snippet_match = re.search(
                    r'<p[^>]*>(.*?)</p>',
                    block,
                    flags=re.DOTALL | re.IGNORECASE
                )

                if link_match:
                    link = link_match.group(1)

                    title = re.sub(
                        r"<.*?>",
                        "",
                        link_match.group(2)
                    ).strip()

                    snippet = ""

                    if snippet_match:
                        snippet = re.sub(
                            r"<.*?>",
                            "",
                            snippet_match.group(1)
                        ).strip()

                    results.append({
                        "title": title,
                        "url": link,
                        "snippet": snippet
                    })

    except Exception as e:
        print(f"⚠️ Error en Bing Search: {e}")

    # --------------------------------------------------------
    # Eliminar duplicados
    # --------------------------------------------------------

    unique = []
    seen = set()

    for result in results:
        key = (
            result.get("title", "").lower(),
            result.get("url", "").lower()
        )

        if key not in seen:
            seen.add(key)
            unique.append(result)

    if not unique:
        return (
            "WEB_SEARCH fue ejecutado, pero no se encontraron "
            "resultados utilizables para esta consulta."
        )

    # --------------------------------------------------------
    # Formatear resultados para Qwen
    # --------------------------------------------------------

    output = [
        "RESULTADOS DE WEB_SEARCH OBLIGATORIO:",
        f"Consulta: {query}",
        ""
    ]

    for index, result in enumerate(unique[:10], start=1):
        output.append(
            f"[{index}] {result.get('title', '')}"
        )

        if result.get("url"):
            output.append(
                f"URL: {result['url']}"
            )

        if result.get("snippet"):
            output.append(
                f"Resumen: {result['snippet']}"
            )

        output.append("")

    return "\n".join(output)


# ============================================================
# WEB FETCH
# ============================================================

def web_fetch(url):
    """
    Obtiene el contenido de una página específica.
    """

    if not url:
        return "No se proporcionó una URL."

    try:
        response = requests.get(
            url,
            timeout=15,
            headers={
                "User-Agent": "Mozilla/5.0"
            }
        )

        response.raise_for_status()

        text = response.text

        # Quitar scripts/styles
        text = re.sub(
            r"<script.*?</script>",
            " ",
            text,
            flags=re.DOTALL | re.IGNORECASE
        )

        text = re.sub(
            r"<style.*?</style>",
            " ",
            text,
            flags=re.DOTALL | re.IGNORECASE
        )

        # Quitar HTML
        text = re.sub(
            r"<[^>]+>",
            " ",
            text
        )

        # Limpiar espacios
        text = re.sub(
            r"\s+",
            " ",
            text
        ).strip()

        # Evitar respuestas gigantes
        return text[:30000]

    except Exception as e:
        return f"No se pudo abrir la página: {e}"


# ============================================================
# IMAGE SEARCH
# ============================================================

def image_search(query):
    """
    Búsqueda sencilla de imágenes.
    """

    query = str(query or "").strip()

    if not query:
        return {
            "query": query,
            "images": []
        }

    images = []

    try:
        response = requests.get(
            "https://www.bing.com/images/search",
            params={
                "q": query
            },
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0"
            }
        )

        if response.ok:
            html = response.text

            matches = re.findall(
                r'murl&quot;:&quot;(.*?)&quot;',
                html
            )

            for url in matches[:12]:
                if url not in images:
                    images.append(url)

    except Exception as e:
        print(f"⚠️ Error en image_search: {e}")

    return {
        "query": query,
        "images": images
    }


# ============================================================
# YOUTUBE
# ============================================================

def youtube_fetch(url):
    """
    Obtiene información/transcripción de YouTube usando Supadata
    si existe SUPADATA_API_KEY.
    """

    api_key = os.environ.get("SUPADATA_API_KEY")

    if not api_key:
        return (
            "SUPADATA_API_KEY no está configurada. "
            "No se puede obtener la transcripción de YouTube."
        )

    if not url:
        return "No se proporcionó una URL de YouTube."

    try:
        response = requests.get(
            "https://api.supadata.ai/v1/youtube/transcript",
            params={
                "url": url
            },
            headers={
                "x-api-key": api_key
            },
            timeout=30
        )

        if not response.ok:
            return (
                f"Supadata devolvió HTTP {response.status_code}: "
                f"{response.text[:2000]}"
            )

        data = response.json()

        return json.dumps(
            data,
            ensure_ascii=False
        )[:30000]

    except Exception as e:
        return f"Error obteniendo YouTube: {e}"


# ============================================================
# TOOLS DISPONIBLES PARA QWEN
# ============================================================

available_tools = {
    "web_search": web_search,
    "web_fetch": web_fetch,
    "image_search": image_search,
    "youtube_fetch": youtube_fetch
}


tools = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Busca información actualizada en Internet. "
                "Úsala cuando necesites información reciente."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Consulta que se desea buscar."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": (
                "Abre y obtiene el contenido de una página web "
                "específica."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL de la página."
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "image_search",
            "description": "Busca imágenes relacionadas con una consulta.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Qué imagen se desea buscar."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "youtube_fetch",
            "description": (
                "Obtiene información o transcripción de un video "
                "de YouTube."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL del video de YouTube."
                    }
                },
                "required": ["url"]
            }
        }
    }
]


# ============================================================
# DETECTAR SOLICITUD DE BÚSQUEDA ADICIONAL
# ============================================================

def user_wants_specific_web_page(text):
    """
    Detecta si el usuario proporcionó una URL.
    """

    if not text:
        return None

    match = re.search(
        r"https?://[^\s]+",
        text
    )

    if match:
        return match.group(0)

    return None


# ============================================================
# BÚSQUEDA OBLIGATORIA
# ============================================================

def mandatory_web_search(user_text):
    """
    ESTA ES LA PARTE IMPORTANTE.

    La búsqueda NO depende de que Qwen quiera utilizar la herramienta.

    Python llama directamente a web_search para CADA mensaje.
    """

    print("🌐 WEB_SEARCH OBLIGATORIO")
    print(f"🔎 Consulta: {user_text}")

    try:
        result = web_search(user_text)

        print("✅ WEB_SEARCH terminado.")

        return result

    except Exception as e:
        print(f"❌ Error en WEB_SEARCH: {e}")

        return (
            "WEB_SEARCH fue intentado, pero ocurrió un error. "
            "Puedes responder usando conocimiento interno como respaldo, "
            "sin afirmar que la información es actual."
        )


# ============================================================
# CONSTRUIR MENSAJES
# ============================================================

def build_messages(user_message, history=None):
    current_datetime = get_current_datetime_text()

    system_prompt = SYSTEM_PROMPT.replace(
        "{CURRENT_DATETIME}",
        current_datetime
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    # Mantener historial
    if history and isinstance(history, list):

        for message in history[-20:]:

            if not isinstance(message, dict):
                continue

            role = message.get("role")
            content = message.get("content")

            if role not in ("user", "assistant"):
                continue

            if not content:
                continue

            messages.append({
                "role": role,
                "content": str(content)
            })

    # ========================================================
    # WEB SEARCH SIEMPRE
    # ========================================================

    web_results = mandatory_web_search(user_message)

    messages.append({
        "role": "system",
        "content": (
            "IMPORTANTE: Antes de responder, se ejecutó "
            "WEB_SEARCH de forma obligatoria para esta consulta.\n\n"
            + web_results
        )
    })

    # Pregunta actual
    messages.append({
        "role": "user",
        "content": user_message
    })

    return messages


# ============================================================
# AGENTE
# ============================================================

def run_agent(user_message, history=None):

    messages = build_messages(
        user_message,
        history
    )

    final_text = ""

    # ========================================================
    # PRIMERA RESPUESTA
    # ========================================================

    try:

        response = ollama_client.chat(
            model=MODEL_NAME,
            messages=messages,
            tools=tools,
            think=True,
            options={
                "num_ctx": 32000
            }
        )

    except Exception as e:

        print(f"❌ Error Ollama: {e}")

        return (
            "Hubo un problema al conectar con el modelo de IA: "
            f"{str(e)}"
        )

    # ========================================================
    # LOOP DE TOOL CALLS
    # ========================================================

    max_tool_rounds = 5

    for _ in range(max_tool_rounds):

        assistant_message = response.message

        # Guardar respuesta del asistente
        messages.append(assistant_message)

        content = getattr(
            assistant_message,
            "content",
            None
        )

        if content:
            final_text = content

        tool_calls = getattr(
            assistant_message,
            "tool_calls",
            None
        )

        if not tool_calls:
            break

        print(
            f"🛠️ Qwen solicitó {len(tool_calls)} herramienta(s)"
        )

        for tool_call in tool_calls:

            try:

                function_name = tool_call.function.name
                arguments = tool_call.function.arguments

                print(
                    f"🔧 Ejecutando herramienta: "
                    f"{function_name}"
                )

                function_to_call = available_tools.get(
                    function_name
                )

                if not function_to_call:

                    result = (
                        f"La herramienta '{function_name}' "
                        "no existe."
                    )

                else:

                    if isinstance(arguments, str):
                        arguments = json.loads(arguments)

                    result = function_to_call(
                        **arguments
                    )

                if isinstance(result, (dict, list)):
                    result_text = json.dumps(
                        result,
                        ensure_ascii=False
                    )
                else:
                    result_text = str(result)

            except Exception as e:

                print(
                    f"❌ Error ejecutando herramienta: {e}"
                )

                result_text = (
                    f"Error ejecutando la herramienta: {e}"
                )

            messages.append({
                "role": "tool",
                "tool_name": function_name,
                "content": result_text
            })

        # ====================================================
        # PEDIRLE AL MODELO QUE CONTINÚE
        # ====================================================

        try:

            response = ollama_client.chat(
                model=MODEL_NAME,
                messages=messages,
                tools=tools,
                think=True,
                options={
                    "num_ctx": 32000
                }
            )

        except Exception as e:

            print(
                f"❌ Error en segunda llamada Ollama: {e}"
            )

            break

    # ========================================================
    # FALLBACK
    # ========================================================

    if not final_text:

        final_text = (
            "No pude generar una respuesta en este momento."
        )

    return final_text


# ============================================================
# API CHAT
# ============================================================

@app.route("/api/chat", methods=["POST"])
def chat():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        user_message = data.get(
            "message",
            ""
        )

        history = data.get(
            "history",
            []
        )

        if not user_message:

            return jsonify({
                "error": "El mensaje está vacío."
            }), 400

        print("=" * 60)
        print("📩 NUEVO MENSAJE")
        print(user_message)
        print("=" * 60)

        answer = run_agent(
            user_message,
            history
        )

        return jsonify({
            "response": answer,
            "model": MODEL_NAME,
            "web_search_used": True
        })

    except Exception as e:

        print(
            f"🔥 ERROR /api/chat: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "service": "ApexAI",
        "model": MODEL_NAME,
        "timezone": APP_TIMEZONE,
        "current_datetime": get_current_datetime_text(),
        "mandatory_web_search": True
    })


# ============================================================
# ROOT
# ============================================================

@app.route("/", methods=["GET"])
def index():

    return jsonify({
        "service": "ApexAI",
        "status": "online",
        "web_search": "mandatory"
    })


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
