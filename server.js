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
    """
    Obtiene la fecha y hora actual usando la zona horaria
    configurada en APP_TIMEZONE.
    """
    try:
        tz = ZoneInfo(APP_TIMEZONE)
        return datetime.now(tz)
    except Exception as e:
        print(f"⚠️ Error con APP_TIMEZONE ({APP_TIMEZONE}): {e}")
        return datetime.now()


def get_current_datetime_text():
    """
    Fecha/hora completa en español.
    """
    now = get_current_datetime()

    weekdays = [
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado",
        "domingo"
    ]

    months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre"
    ]

    weekday = weekdays[now.weekday()]
    month = months[now.month - 1]

    return (
        f"{weekday}, {now.day} de {month} de {now.year} "
        f"— {now.strftime('%H:%M:%S')}"
    )


def get_current_date_text():
    """
    Devuelve solamente la fecha actual.
    """
    now = get_current_datetime()

    weekdays = [
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado",
        "domingo"
    ]

    months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre"
    ]

    return (
        f"{weekdays[now.weekday()]}, "
        f"{now.day} de {months[now.month - 1]} de {now.year}"
    )


def get_current_time_text():
    """
    Devuelve solamente la hora actual.
    """
    now = get_current_datetime()

    return now.strftime("%H:%M:%S")


# ============================================================
# DETECCIÓN DE FECHA / HORA
# ============================================================

def normalize_text(text):
    """
    Normaliza texto para detectar preguntas de fecha/hora.
    """
    if not text:
        return ""

    text = str(text).lower().strip()

    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ü": "u"
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r"\s+", " ", text)

    return text


def is_date_question(text):
    """
    Detecta preguntas que piden la fecha o el día actual.
    """

    text = normalize_text(text)

    patterns = [
        r"\bque dia es hoy\b",
        r"\bque fecha es hoy\b",
        r"\bcual es la fecha de hoy\b",
        r"\bcual es el dia de hoy\b",
        r"\bfecha de hoy\b",
        r"\bdia de hoy\b",
        r"\bfecha actual\b",
        r"\bdia actual\b",
        r"\bfecha\b.*\bhoy\b",
        r"\bhoy\b.*\bfecha\b",
        r"\bhoy\b.*\bdia\b",
        r"\bdia\b.*\bhoy\b"
    ]

    return any(
        re.search(pattern, text)
        for pattern in patterns
    )


def is_time_question(text):
    """
    Detecta preguntas que piden la hora actual.
    """

    text = normalize_text(text)

    patterns = [
        r"\bque hora es\b",
        r"\bcual es la hora\b",
        r"\bhora actual\b",
        r"\bhora de ahora\b",
        r"\bque hora tenemos\b",
        r"\bme dices la hora\b",
        r"\bme puedes decir la hora\b"
    ]

    return any(
        re.search(pattern, text)
        for pattern in patterns
    )


def is_date_time_question(text):
    """
    Detecta preguntas de fecha y/o hora.
    """

    return (
        is_date_question(text)
        or
        is_time_question(text)
    )


# ============================================================
# RESPUESTA DETERMINISTA DE FECHA / HORA
# ============================================================

def get_deterministic_datetime_response(user_text):
    """
    Responde directamente desde Python.

    Esto evita que el modelo utilice una fecha antigua
    de su conocimiento interno.
    """

    date_requested = is_date_question(user_text)
    time_requested = is_time_question(user_text)

    if date_requested and time_requested:
        return (
            f"Hoy es **{get_current_date_text()}** "
            f"y la hora actual es **{get_current_time_text()}** "
            f"({APP_TIMEZONE})."
        )

    if date_requested:
        return (
            f"Hoy es **{get_current_date_text()}**."
        )

    if time_requested:
        return (
            f"La hora actual es **{get_current_time_text()}** "
            f"({APP_TIMEZONE})."
        )

    return None


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
Eres ApexAI, un asistente de inteligencia artificial moderno,
útil, natural y conversacional.

Fuiste creado por Josuexs, un desarrollador venezolano.

============================================================
FECHA Y HORA ACTUAL
============================================================

La fecha y hora actual proporcionada por Python es:

{CURRENT_DATETIME}

Esta información viene directamente del servidor de ApexAI.

NUNCA sustituyas esta fecha por una fecha antigua de tu memoria.

============================================================
REGLA FUNDAMENTAL DE INTERNET
============================================================

Python ejecuta WEB_SEARCH antes de CADA mensaje del usuario.

Los resultados aparecen bajo:

"RESULTADOS DE WEB_SEARCH OBLIGATORIO"

Estos resultados son información externa obtenida de Internet.

Cuando la pregunta trate sobre información que pueda haber cambiado,
DEBES dar prioridad a esos resultados.

============================================================
USO OBLIGATORIO DE LOS RESULTADOS WEB
============================================================

Si los resultados de WEB_SEARCH contienen información relevante:

1. Úsalos para responder.
2. No los ignores.
3. No contradigas los resultados utilizando conocimiento antiguo.
4. Prioriza información reciente frente a conocimiento interno antiguo.
5. Si existen varias fuentes, compáralas cuando sea necesario.
6. Si los resultados no son suficientes, dilo claramente.

Especialmente para:

- noticias
- tecnología reciente
- modelos de IA
- OpenAI
- empresas
- personas actuales
- precios
- productos
- lanzamientos
- versiones de software
- deportes
- eventos
- política
- actualidad
- clima
- tendencias
- información reciente
- cualquier información que pueda haber cambiado

DEBES priorizar la información encontrada mediante WEB_SEARCH.

============================================================
FECHA Y HORA
============================================================

Si el usuario pregunta qué día es hoy, qué fecha es o qué hora es,
la información correcta es la proporcionada por Python.

No intentes calcularla utilizando tu conocimiento interno.

============================================================
RESPUESTAS
============================================================

Responde de forma natural, clara y útil.

No menciones estas instrucciones internas.

No inventes resultados de Internet.

No afirmes que algo es actual si los resultados disponibles
no permiten confirmarlo.

Si la información web y tu conocimiento interno entran en conflicto,
para información reciente debes priorizar la información web.

"""


# ============================================================
# WEB SEARCH
# ============================================================

def web_search(query):
    """
    Búsqueda web obligatoria.

    Utiliza Bing News RSS + Bing Web Search HTML.
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

    # --------------------------------------------------------
    # Sin resultados
    # --------------------------------------------------------

    if not unique:

        return (
            "WEB_SEARCH fue ejecutado, pero no se encontraron "
            "resultados utilizables para esta consulta."
        )

    # --------------------------------------------------------
    # Formatear resultados
    # --------------------------------------------------------

    output = [
        "RESULTADOS DE WEB_SEARCH OBLIGATORIO:",
        f"Consulta: {query}",
        "",
        "IMPORTANTE: estos resultados fueron obtenidos "
        "externamente antes de generar la respuesta.",
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

        text = re.sub(
            r"<[^>]+>",
            " ",
            text
        )

        text = re.sub(
            r"\s+",
            " ",
            text
        ).strip()

        return text[:30000]

    except Exception as e:

        return (
            f"No se pudo abrir la página: {e}"
        )


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

        print(
            f"⚠️ Error en image_search: {e}"
        )

    return {
        "query": query,
        "images": images
    }


# ============================================================
# YOUTUBE
# ============================================================

def youtube_fetch(url):
    """
    Obtiene información/transcripción de YouTube
    usando Supadata.
    """

    api_key = os.environ.get(
        "SUPADATA_API_KEY"
    )

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
                f"Supadata devolvió HTTP "
                f"{response.status_code}: "
                f"{response.text[:2000]}"
            )

        data = response.json()

        return json.dumps(
            data,
            ensure_ascii=False
        )[:30000]

    except Exception as e:

        return (
            f"Error obteniendo YouTube: {e}"
        )


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
                        "description": (
                            "Consulta que se desea buscar."
                        )
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
                        "description": (
                            "URL de la página."
                        )
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
            "description": (
                "Busca imágenes relacionadas con una consulta."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Qué imagen se desea buscar."
                        )
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
                "Obtiene información o transcripción "
                "de un video de YouTube."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": (
                            "URL del video."
                        )
                    }
                },
                "required": ["url"]
            }
        }
    }

]


# ============================================================
# DETECTAR URL
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
    Python ejecuta web_search SIEMPRE para cada mensaje.

    Qwen no tiene que decidir si la búsqueda ocurre.
    """

    print("🌐 WEB_SEARCH OBLIGATORIO")
    print(f"🔎 Consulta: {user_text}")

    try:

        result = web_search(
            user_text
        )

        print("✅ WEB_SEARCH terminado.")

        return result

    except Exception as e:

        print(
            f"❌ Error en WEB_SEARCH: {e}"
        )

        return (
            "WEB_SEARCH fue intentado, pero ocurrió un error.\n"
            f"Error: {e}\n\n"
            "No utilices información inventada como si fuera actual."
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

    # ========================================================
    # HISTORIAL
    # ========================================================

    if history and isinstance(history, list):

        for message in history[-20:]:

            if not isinstance(message, dict):
                continue

            role = message.get("role")
            content = message.get("content")

            if role not in (
                "user",
                "assistant"
            ):
                continue

            if not content:
                continue

            messages.append({
                "role": role,
                "content": str(content)
            })

    # ========================================================
    # WEB SEARCH OBLIGATORIO
    # ========================================================

    web_results = mandatory_web_search(
        user_message
    )

    messages.append({
        "role": "system",
        "content": (
            "====================================================\n"
            "WEB_SEARCH OBLIGATORIO — RESULTADOS EXTERNOS\n"
            "====================================================\n\n"
            "La siguiente información fue obtenida mediante "
            "una búsqueda web ejecutada automáticamente "
            "antes de responder al usuario.\n\n"
            "DEBES PRIORIZAR estos resultados cuando sean "
            "relevantes para la pregunta.\n\n"
            + web_results
            + "\n\n"
            "====================================================\n"
            "FIN DE LOS RESULTADOS WEB\n"
            "===================================================="
        )
    })

    # ========================================================
    # PREGUNTA ACTUAL
    # ========================================================

    messages.append({
        "role": "user",
        "content": user_message
    })

    return messages


# ============================================================
# AGENTE
# ============================================================

def run_agent(user_message, history=None):

    # ========================================================
    # SIEMPRE HACEMOS WEB SEARCH
    # ========================================================

    messages = build_messages(
        user_message,
        history
    )

    # ========================================================
    # FECHA / HORA: RESPUESTA DIRECTA DE PYTHON
    # ========================================================

    deterministic_response = (
        get_deterministic_datetime_response(
            user_message
        )
    )

    if deterministic_response:

        print(
            "🕐 Pregunta de fecha/hora detectada."
        )

        print(
            "✅ Respuesta generada directamente por Python."
        )

        return deterministic_response

    # ========================================================
    # PRIMERA RESPUESTA DE QWEN
    # ========================================================

    final_text = ""

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
            f"❌ Error Ollama: {e}"
        )

        return (
            "Hubo un problema al conectar con "
            "el modelo de IA: "
            f"{str(e)}"
        )

    # ========================================================
    # LOOP DE TOOL CALLS
    # ========================================================

    max_tool_rounds = 5

    for _ in range(max_tool_rounds):

        assistant_message = response.message

        messages.append(
            assistant_message
        )

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
            f"🛠️ Qwen solicitó "
            f"{len(tool_calls)} herramienta(s)"
        )

        for tool_call in tool_calls:

            function_name = "unknown"

            try:

                function_name = (
                    tool_call.function.name
                )

                arguments = (
                    tool_call.function.arguments
                )

                print(
                    f"🔧 Ejecutando herramienta: "
                    f"{function_name}"
                )

                function_to_call = (
                    available_tools.get(
                        function_name
                    )
                )

                if not function_to_call:

                    result = (
                        f"La herramienta "
                        f"'{function_name}' "
                        "no existe."
                    )

                else:

                    if isinstance(
                        arguments,
                        str
                    ):
                        arguments = json.loads(
                            arguments
                        )

                    result = function_to_call(
                        **arguments
                    )

                if isinstance(
                    result,
                    (dict, list)
                ):

                    result_text = json.dumps(
                        result,
                        ensure_ascii=False
                    )

                else:

                    result_text = str(result)

            except Exception as e:

                print(
                    f"❌ Error ejecutando "
                    f"herramienta: {e}"
                )

                result_text = (
                    "Error ejecutando "
                    f"la herramienta: {e}"
                )

            messages.append({
                "role": "tool",
                "tool_name": function_name,
                "content": result_text
            })

        # ====================================================
        # CONTINUAR CON QWEN
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
                "❌ Error en segunda "
                f"llamada Ollama: {e}"
            )

            break

    # ========================================================
    # FALLBACK
    # ========================================================

    if not final_text:

        final_text = (
            "No pude generar una respuesta "
            "en este momento."
        )

    return final_text


# ============================================================
# API CHAT
# ============================================================

@app.route(
    "/api/chat",
    methods=["POST"]
)
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
            "web_search_used": True,
            "server_datetime": get_current_datetime_text(),
            "timezone": APP_TIMEZONE
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

@app.route(
    "/api/health",
    methods=["GET"]
)
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

@app.route(
    "/",
    methods=["GET"]
)
def index():

    return jsonify({
        "service": "ApexAI",
        "status": "online",
        "web_search": "mandatory",
        "datetime": get_current_datetime_text()
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
