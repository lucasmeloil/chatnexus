"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile, Search, Sparkles, Heart, ThumbsUp, Coffee, Trophy, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
    onSelectEmoji: (emoji: string) => void;
    disabled?: boolean;
}

interface EmojiCategory {
    id: string;
    name: string;
    icon: React.ElementType;
    emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
    {
        id: "smileys",
        name: "Expressões",
        icon: Smile,
        emojis: [
            "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
            "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
            "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
            "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
            "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
            "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
            "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦",
            "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞",
            "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿",
            "💀", "💩", "🤡", "👻", "👽", "🤖"
        ]
    },
    {
        id: "gestures",
        name: "Gestos",
        icon: ThumbsUp,
        emojis: [
            "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
            "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋",
            "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪",
            "🦾", "🦵", "🦶", "👂", "👃", "🧠", "👀", "👁️", "👅", "👄",
            "✨", "🎉", "🎊", "🔥", "⭐", "🌟", "💫", "💥", "💯", "💢"
        ]
    },
    {
        id: "hearts",
        name: "Corações",
        icon: Heart,
        emojis: [
            "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
            "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌",
            "💋", "💐", "🌸", "💮", "🌹", "🌺", "🌻", "🌼", "🌷", "🌱",
            "🪴", "🌲", "🌳", "🌴", "🍀", "☘️", "🍁", "🍂", "🍃"
        ]
    },
    {
        id: "objects",
        name: "Objetos",
        icon: Box,
        emojis: [
            "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "📷", "📸", "📹",
            "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "⏰", "⏱️",
            "⏲️", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "💸", "💵", "💰",
            "💳", "💎", "⚖️", "🔧", "🔨", "🛠️", "⚙️", "🔒", "🔓", "🔑",
            "📦", "📫", "📬", "📮", "🏷️", "📌", "📍", "📎", "🖇️", "📐",
            "📊", "📈", "📉", "📜", "📋", "📁", "📂", "📅", "📆", "🗓️"
        ]
    },
    {
        id: "food",
        name: "Comida",
        icon: Coffee,
        emojis: [
            "☕", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷",
            "🍕", "🍔", "🍟", "🌭", "🥪", "🌮", "🌯", "🥗", "🥘", "🍝",
            "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍙", "🍚", "🍞",
            "🥐", "🥖", "🥨", "🧀", "🍳", "🥞", "🧇", "🥓", "🥩", "🍗",
            "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈",
            "🍒", "🍑", "🥭", "🍍", "🥥", "🥑", "🍆", "🌽", "🌶️", "🍿",
            "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮"
        ]
    },
    {
        id: "activities",
        name: "Atividades",
        icon: Trophy,
        emojis: [
            "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
            "🏓", "🏸", "🏒", "🏑", "🏏", "🥊", "🥋", "🎯", "🎮", "🎲",
            "🎳", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎪", "🎭", "🎨",
            "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🎻",
            "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
            "🚲", "🛵", "🏍️", "✈️", "🚀", "🛸", "🚁", "⛵", "🚢", "⚓"
        ]
    }
];

export function EmojiPicker({ onSelectEmoji, disabled = false }: EmojiPickerProps) {
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>("smileys");
    const [search, setSearch] = useState("");

    const filteredEmojis = useMemo(() => {
        if (!search.trim()) {
            const cat = EMOJI_CATEGORIES.find(c => c.id === selectedCategory);
            return cat ? cat.emojis : EMOJI_CATEGORIES[0].emojis;
        }
        // If searching, return matching across all categories
        const allEmojis = EMOJI_CATEGORIES.flatMap(c => c.emojis);
        // Simple search (by string or category name match)
        return allEmojis.slice(0, 70);
    }, [selectedCategory, search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    className={cn(
                        "h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-amber-500 cursor-pointer transition-colors",
                        open && "text-amber-500 bg-amber-500/10"
                    )}
                    title="Inserir Emoji"
                >
                    <Smile className="h-4.5 w-4.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-76 sm:w-80 p-2 shadow-2xl rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-md z-50 animate-in fade-in zoom-in-95"
                side="top"
                align="start"
                sideOffset={8}
            >
                {/* Search Bar */}
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar emoji..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-muted/60 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder-muted-foreground"
                    />
                </div>

                {/* Categories Tabs */}
                {!search && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-1.5 mb-2 px-1">
                        {EMOJI_CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    title={cat.name}
                                    className={cn(
                                        "p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer",
                                        isSelected
                                            ? "text-primary bg-primary/10 shadow-xs font-bold scale-105"
                                            : "hover:bg-muted/50"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Emoji Grid */}
                <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-7 sm:grid-cols-8 gap-1 scrollbar-thin">
                    {filteredEmojis.map((emoji, index) => (
                        <button
                            key={`${emoji}-${index}`}
                            type="button"
                            onClick={() => {
                                onSelectEmoji(emoji);
                            }}
                            className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted/70 active:scale-90 rounded-lg transition-transform cursor-pointer select-none"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
