import React from 'react';
// Make sure to import these icons from your icon library (e.g., lucide-react)
import { Search, X, Loader2, UserPlus, Building2, Menu, PanelLeft } from 'lucide-react';

export default function Header({ 
  setMobileOpen, 
  setSidebarOpen, 
  desktopMenu, 
  location, 
  searchRef, 
  searchOpen, 
  setSearchOpen, 
  searchLoading, 
  searchQuery, 
  handleSearch, 
  handleSearchKeyDown, 
  clearSearch, 
  searchResults, 
  highlightedIndex, 
  goToCustomer, 
  goAddCustomer, 
  currentBranch, 
  uiT 
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-th-border/80 bg-white/80 px-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl lg:px-6">
      
      {/* --- Left Section: Menus & Title --- */}
      <div className="flex w-1/4 items-center gap-3">
        <button 
          onClick={() => setMobileOpen(true)} 
          aria-label="Open mobile menu" 
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-th-text transition-all duration-200 hover:border-[#1ed760]/20 hover:bg-th-hover/80 hover:shadow-sm lg:hidden"
        >
          <Menu size={20} />
        </button>
        
        <button 
          onClick={() => setSidebarOpen(true)} 
          aria-label="Open sidebar" 
          className="hidden h-9 w-9 items-center justify-center rounded-xl border border-transparent text-th-text transition-all duration-200 hover:border-[#1ed760]/20 hover:bg-th-hover/80 hover:shadow-sm lg:flex"
        >
          <PanelLeft size={20} />
        </button>
        
        <h2 className="hidden truncate text-sm font-semibold uppercase tracking-[0.22em] text-th-text/90 sm:block">
          {desktopMenu.find((m) => m.path === location.pathname)?.label || "Dashboard"}
        </h2>
      </div>

      {/* --- Center Section: Search Bar --- */}
      <div 
        ref={searchRef} 
        className="relative mx-2 flex w-full max-w-xl flex-1 items-center justify-center lg:mx-4"
      >
        <div
          className={`group flex w-full items-center rounded-full border bg-th-surface/90 backdrop-blur-xl transition-all duration-300 ease-out ${
            searchOpen
              ? "border-[#1ed760]/50 ring-4 ring-[#1ed760]/10 shadow-[0_10px_32px_rgba(30,215,96,0.14)]"
              : "border-th-border/70 hover:border-[#1ed760]/30 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          }`}
        >
          {/* Search Icon / Loader */}
          <div
            className={`ml-4 mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${
              searchLoading || searchOpen
                ? "text-[#1ed760]"
                : "text-th-secondary group-hover:text-[#1ed760]"
            }`}
          >
            {searchLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} className="transition-transform duration-300 group-hover:scale-110" />
            )}
          </div>

          {/* Input Field */}
          <input
            type="text"
            placeholder={uiT("Search customers...", "ग्राहक खोजें...")}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (searchQuery.trim()) setSearchOpen(true);
            }}
            className="w-full bg-transparent py-3 pr-4 text-[16px] font-medium text-th-text placeholder-th-secondary/70 outline-none transition-all duration-300 placeholder:font-normal"
            aria-label="Search customers"
          />

          {/* Clear Button */}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="mr-2 flex h-9 w-9 items-center justify-center rounded-full text-th-secondary/80 transition-all duration-200 hover:bg-white/15 hover:text-th-text hover:scale-110 active:scale-95"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* --- Search Results Dropdown --- */}
        {searchOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full z-50 mt-3 max-h-[22rem] flex flex-col overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] glass-panel">
            
            {/* Scrollable Results Area */}
            <div className="flex-1 overflow-y-auto scrollbar-none">
              {searchLoading ? (
                <div className=" space-y-3 px-4 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-th-hover" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-32 rounded bg-th-hover" />
                        <div className="h-2.5 w-20 rounded bg-th-hover/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="py-2">
                  {searchResults.map((c, index) => (
                    <SearchResultItem
                      key={String(c._id ?? `${(c as any).name}-${index}`)}
                      customer={c}
                      isHighlighted={index === highlightedIndex}
                      onClick={() => goToCustomer(String(c._id ?? ""))}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-th-secondary">
                  <p className="font-medium text-th-text">{uiT("No customer found", "कोई ग्राहक नहीं मिला")}</p>
                  <p className="mt-1.5 text-xs opacity-80">
                    {uiT("Try a name, phone number, or customer ID", "नाम, फोन नंबर या ग्राहक आईडी से कोशिश करें")}
                  </p>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="border-t border-white/10 bg-black/20 p-3 backdrop-blur-md">
              <button 
                onClick={goAddCustomer}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ed760] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
              >
                <UserPlus size={16} /> 
                {uiT("Add New Customer", "नया ग्राहक जोड़ें")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Right Section: Branch Indicator --- */}
      <div className="flex w-1/4 items-center justify-end">
        {currentBranch && (
          <div className="flex items-center gap-2 rounded-full border border-[#1ed760]/20 bg-gradient-to-r from-[#1ed760]/10 to-[#509bf5]/10 px-3 py-1.5 text-xs font-semibold text-th-text shadow-sm">
            <Building2 size={14} className="text-[#1ed760]" />
            <span className="hidden sm:inline-block max-w-[120px] truncate">
              {currentBranch.name}
            </span>
          </div>
        )}
      </div>
      
    </header>
  );
}