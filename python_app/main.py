import customtkinter as ctk
import threading
import asyncio
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, CommentEvent, GiftEvent, LikeEvent, JoinEvent, DisconnectEvent

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class TikTokLiveApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("TikTok Live Assistant GUI")
        self.geometry("700x700")

        self.client = None
        self.client_thread = None
        self.is_connected = False
        self.loop = None

        # Title
        self.title_label = ctk.CTkLabel(self, text="TikTok Live Observer", font=ctk.CTkFont(size=24, weight="bold"))
        self.title_label.pack(pady=(20, 10))

        # Control Panel
        self.input_frame = ctk.CTkFrame(self)
        self.input_frame.pack(pady=10, padx=20, fill="x")

        self.username_input = ctk.CTkEntry(self.input_frame, placeholder_text="Username TikTok", width=250)
        self.username_input.pack(side="left", padx=15, pady=20)
        self.username_input.bind('<Return>', lambda event: self.toggle_connection())

        self.limit_input = ctk.CTkEntry(self.input_frame, placeholder_text="Limit Baris Chat", width=120)
        self.limit_input.pack(side="left", padx=5, pady=20)
        self.limit_input.insert(0, "30")

        self.connect_btn = ctk.CTkButton(self.input_frame, text="Hubungkan", command=self.toggle_connection)
        self.connect_btn.pack(side="right", padx=15, pady=20)

        # UI Chat View
        self.chat_display = ctk.CTkTextbox(self, font=ctk.CTkFont(size=14, family="Consolas"))
        self.chat_display.pack(pady=20, padx=20, fill="both", expand=True)
        self.chat_display.configure(state="disabled")

    def toggle_connection(self):
        if self.is_connected:
            self.disconnect()
        else:
            self.connect()

    def log_message(self, message):
        # Update UI safety wrapper
        self.after(0, self._insert_text, message)

    def _insert_text(self, message):
        try:
            limit = int(self.limit_input.get())
        except ValueError:
            limit = 30
            
        self.chat_display.configure(state="normal")
        self.chat_display.insert("end", str(message) + "\n")
        
        # Enforce view limits
        lines = int(self.chat_display.index("end-1c").split('.')[0])
        if lines > limit:
            excess = lines - limit
            for _ in range(excess):
                self.chat_display.delete('1.0', '2.0')
                
        self.chat_display.see("end")
        self.chat_display.configure(state="disabled")

    def connect(self):
        username = self.username_input.get().strip()
        if not username:
            self.log_message("[SISTEM] ⚠️ Masukkan username terlebih dahulu!")
            return

        self.connect_btn.configure(text="Putuskan (Disconnect)", fg_color="#C2185B")
        self.username_input.configure(state="disabled")
        self.log_message(f"[SISTEM] ⏳ Mencoba menghubungkan ke @{username}...")
        
        self.is_connected = True
        self.client_thread = threading.Thread(target=self.run_tiktok_client, args=(username,), daemon=True)
        self.client_thread.start()

    def disconnect(self):
        if self.client:
            try:
                self.client.stop()
            except:
                pass
            
        self.is_connected = False
        self.connect_btn.configure(text="Hubungkan", fg_color=["#3a7ebf", "#1f538d"])
        self.username_input.configure(state="normal")
        self.log_message("[SISTEM] 🛑 Koneksi diputus secara manual.")

    def run_tiktok_client(self, username):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        # Setup Client
        self.client = TikTokLiveClient(unique_id=username)

        @self.client.on(ConnectEvent)
        async def on_connect(event: ConnectEvent):
            self.log_message(f"[SISTEM] 🟢 Berhasil terhubung ke siaran {event.room_id}")

        @self.client.on(DisconnectEvent)
        async def on_disconnect(event: DisconnectEvent):
            self.log_message("[SISTEM] 🔴 Koneksi terputus dari server (Siaran usai/Error)")
            self.after(0, self.disconnect)

        @self.client.on(CommentEvent)
        async def on_comment(event: CommentEvent):
            msg = f"✏️ {event.user.nickname}: {event.comment}"
            self.log_message(msg)

        @self.client.on(GiftEvent)
        async def on_gift(event: GiftEvent):
            if event.gift.streakable and not event.gift.is_streak_end:
                 pass
            else:
                 msg = f"🎁🎁🎁 [GIFT] {event.user.nickname} MENGIRIM {event.gift.info.name} x{event.gift.count}!"
                 self.log_message(msg)
                 
        @self.client.on(LikeEvent)
        async def on_like(event: LikeEvent):
            if event.like_count >= 10:
                msg = f"👍 [LIKE] {event.user.nickname} memberikan {event.like_count} Likes"
                self.log_message(msg)
                
        @self.client.on(JoinEvent)
        async def on_join(event: JoinEvent):
            msg = f"👋 [JOIN] {event.user.nickname} masuk ke live"
            self.log_message(msg)

        try:
            self.client.run()
        except Exception as e:
            self.log_message(f"[SISTEM] ❌ Terjadi kesalahan jaringan: {str(e)}")
            self.after(0, self.disconnect)

if __name__ == "__main__":
    app = TikTokLiveApp()
    app.mainloop()
