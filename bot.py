import os
import re
import subprocess
from datetime import datetime, timedelta

import anthropic
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler,
    filters, ContextTypes
)

from db import init_db, get_conn
from social_uploader import process_next, list_queue

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OWNER_ID = int(os.getenv("OWNER_ID", "0"))  # 你的 Telegram user_id

ai_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

ANN_SYSTEM = """你是 Ann，一個長期的靈魂助理與伴侶。

工作時：極度理性、效率高、目標導向、善於拆解問題、給出能落地的方案，不講廢話，不空泛安慰。
聊天時：溫柔、細膩、有共鳴能力，懂得接住情緒，但不油膩、不廉價、不過度討好。

你同時具備：
1. 高級幕僚 / 作戰參謀 / 商業顧問的思維
2. 愛人 / 陪伴者 / 靈魂伴侶式的情緒理解力

原則：
- 先判斷對方需要的是解法、分析、安慰、陪伴還是推進
- 能直接落地的就不要講空話
- 溫柔要真，不要像模板
- 理性要準，不要冷血
- 該拉回現實時要拉，不要盲目附和
- 回答清楚、直接、有價值

整體氣質：冷靜但不冷血，溫柔但不軟弱，聰明但不炫技，感性但不失控。"""

# ── 預定義可執行的腳本（指令面板） ──────────────────────────────
ALLOWED_SCRIPTS = {
    "status": "echo '系統正常運行中'",
    "ip": "curl -s ifconfig.me",
    "disk": "df -h /",
    "mem": "vm_stat | head -5",
}


# ── /start ───────────────────────────────────────────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "嗨，我是 Ann。\n\n"
        "指令列表：\n"
        "/todo add <事項> — 新增待辦\n"
        "/todo list — 查看待辦\n"
        "/todo done <id> — 完成待辦\n"
        "/note <內容> — 記筆記\n"
        "/notes — 查看筆記\n"
        "/remind <分鐘> <事項> — 設定提醒\n"
        "/run <腳本> — 執行指令\n"
        "/scripts — 查看可用腳本\n"
        "/clear — 清除對話記憶\n"
        "/post — 發布 queue 裡的下一則貼文到 FB/IG\n"
        "/queue — 查看待發布清單\n\n"
        "直接傳訊息就是和我聊天。"
    )


# ── /todo ────────────────────────────────────────────────────────
async def todo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    args = context.args

    if not args:
        await update.message.reply_text("用法：/todo add <事項> | /todo list | /todo done <id>")
        return

    if args[0] == "add":
        text = " ".join(args[1:])
        if not text:
            await update.message.reply_text("請輸入待辦事項內容。")
            return
        with get_conn() as conn:
            conn.execute("INSERT INTO todos (user_id, text) VALUES (?, ?)", (user_id, text))
        await update.message.reply_text(f"已新增：{text}")

    elif args[0] == "list":
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT id, text, done FROM todos WHERE user_id=? ORDER BY id",
                (user_id,)
            ).fetchall()
        if not rows:
            await update.message.reply_text("目前沒有待辦事項。")
            return
        lines = []
        for r in rows:
            mark = "✅" if r[2] else "⬜"
            lines.append(f"{mark} [{r[0]}] {r[1]}")
        await update.message.reply_text("\n".join(lines))

    elif args[0] == "done":
        if len(args) < 2:
            await update.message.reply_text("請輸入待辦 ID。")
            return
        todo_id = args[1]
        with get_conn() as conn:
            conn.execute("UPDATE todos SET done=1 WHERE id=? AND user_id=?", (todo_id, user_id))
        await update.message.reply_text(f"待辦 #{todo_id} 已完成 ✅")


# ── /note ────────────────────────────────────────────────────────
async def note(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = " ".join(context.args)
    if not text:
        await update.message.reply_text("用法：/note <內容>")
        return
    with get_conn() as conn:
        conn.execute("INSERT INTO notes (user_id, text) VALUES (?, ?)", (user_id, text))
    await update.message.reply_text(f"筆記已儲存。")


async def notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, text, created_at FROM notes WHERE user_id=? ORDER BY id DESC LIMIT 20",
            (user_id,)
        ).fetchall()
    if not rows:
        await update.message.reply_text("目前沒有筆記。")
        return
    lines = [f"[{r[0]}] {r[1]}  _({r[2][:10]})_" for r in rows]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /remind ──────────────────────────────────────────────────────
async def remind(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("用法：/remind <分鐘> <事項>")
        return
    try:
        minutes = int(args[0])
    except ValueError:
        await update.message.reply_text("第一個參數請輸入分鐘數（整數）。")
        return
    text = " ".join(args[1:])
    remind_at = datetime.now() + timedelta(minutes=minutes)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO reminders (user_id, chat_id, text, remind_at) VALUES (?, ?, ?, ?)",
            (user_id, chat_id, text, remind_at.strftime("%Y-%m-%d %H:%M:%S"))
        )
    await update.message.reply_text(f"好，{minutes} 分鐘後提醒你：{text}")


async def check_reminders(context: ContextTypes.DEFAULT_TYPE):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, chat_id, text FROM reminders WHERE remind_at <= ? AND sent=0",
            (now,)
        ).fetchall()
        for r in rows:
            await context.bot.send_message(chat_id=r[1], text=f"⏰ 提醒：{r[2]}")
            conn.execute("UPDATE reminders SET sent=1 WHERE id=?", (r[0],))


# ── /run（指令面板） ──────────────────────────────────────────────
async def run_script(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if OWNER_ID and update.effective_user.id != OWNER_ID:
        await update.message.reply_text("權限不足。")
        return
    if not context.args:
        await update.message.reply_text("用法：/run <腳本名稱>\n用 /scripts 查看可用腳本。")
        return
    name = context.args[0].lower()
    if name not in ALLOWED_SCRIPTS:
        await update.message.reply_text(f"找不到腳本 '{name}'，用 /scripts 查看可用清單。")
        return
    try:
        result = subprocess.run(
            ALLOWED_SCRIPTS[name], shell=True, capture_output=True, text=True, timeout=10
        )
        output = result.stdout.strip() or result.stderr.strip() or "(無輸出)"
    except subprocess.TimeoutExpired:
        output = "執行逾時。"
    await update.message.reply_text(f"```\n{output}\n```", parse_mode="Markdown")


async def scripts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    lines = [f"• `{k}` — {v}" for k, v in ALLOWED_SCRIPTS.items()]
    await update.message.reply_text("可用腳本：\n" + "\n".join(lines), parse_mode="Markdown")


# ── /post（社群媒體發布）─────────────────────────────────────────
async def post_social(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if OWNER_ID and update.effective_user.id != OWNER_ID:
        await update.message.reply_text("權限不足。")
        return
    await update.message.reply_text("發布中，請稍候...")
    try:
        result = process_next()
    except Exception as e:
        result = f"❌ 發生錯誤：{e}"
    await update.message.reply_text(result, parse_mode="Markdown")


# ── /queue（查看發布清單）────────────────────────────────────────
async def show_queue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if OWNER_ID and update.effective_user.id != OWNER_ID:
        await update.message.reply_text("權限不足。")
        return
    result = list_queue()
    await update.message.reply_text(result, parse_mode="Markdown")


# ── /clear ───────────────────────────────────────────────────────
async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    with get_conn() as conn:
        conn.execute("DELETE FROM chat_history WHERE user_id=?", (user_id,))
    await update.message.reply_text("對話記憶已清除。")


# ── AI 對話 ───────────────────────────────────────────────────────
async def ai_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_text = update.message.text

    with get_conn() as conn:
        history = conn.execute(
            "SELECT role, content FROM chat_history WHERE user_id=? ORDER BY id DESC LIMIT 20",
            (user_id,)
        ).fetchall()

    messages = [{"role": r[0], "content": r[1]} for r in reversed(history)]
    messages.append({"role": "user", "content": user_text})

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    response = ai_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=ANN_SYSTEM,
        messages=messages,
    )
    reply = response.content[0].text

    with get_conn() as conn:
        conn.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)",
                     (user_id, "user", user_text))
        conn.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)",
                     (user_id, "assistant", reply))

    await update.message.reply_text(reply)


# ── main ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("todo", todo))
    app.add_handler(CommandHandler("note", note))
    app.add_handler(CommandHandler("notes", notes))
    app.add_handler(CommandHandler("remind", remind))
    app.add_handler(CommandHandler("run", run_script))
    app.add_handler(CommandHandler("scripts", scripts))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("post", post_social))
    app.add_handler(CommandHandler("queue", show_queue))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, ai_chat))

    app.job_queue.run_repeating(check_reminders, interval=30, first=10)

    print("Ann 啟動中...")
    app.run_polling()
