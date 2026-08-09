export const panelStyles = {
    workspaceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px', height: '85vh', background: '#f9f9f9', position: 'relative' },
    chatContainer: { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%', minHeight: '0', position: 'relative' },
    previewContainer: { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflowY: 'auto', height: '100%' },
    previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f0f2f5', paddingBottom: '8px', marginBottom: '12px' },
    buttonGroup: { display: 'flex', gap: '8px' },
    
    primaryActionButton: { fontSize: '0.8rem', padding: '6px 12px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' },
    neutralActionButton: { fontSize: '0.8rem', padding: '6px 12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' },
  
    messagesViewport: { flex: 1, overflowY: 'auto', paddingRight: '6px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
    
    userBubble: { background: '#1e3a8a', color: '#fff', padding: '10px 14px', borderRadius: '12px 12px 2px 12px', alignSelf: 'flex-end', marginLeft: 'auto', maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: '0.95rem', fontFamily: 'inherit' },
    assistantBubble: { background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', alignSelf: 'flex-start', marginRight: 'auto', maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: '0.95rem', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', fontFamily: 'inherit' },
    
    userRoleLabel: { display: 'block', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', color: '#93c5fd', fontFamily: 'inherit' },
    assistantRoleLabel: { display: 'block', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', color: '#2563eb', fontFamily: 'inherit' },
    loadingRow: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '22px' },
    loadingSpinner: { width: '14px', height: '14px', flex: '0 0 auto', border: '2px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'das-loading-spin 0.8s linear infinite' },
    loadingText: { color: '#475569', animation: 'das-loading-pulse 1.4s ease-in-out infinite' },
    
    composerFormWrapper: { position: 'relative', borderTop: '1px solid #eee', paddingTop: '10px' },
    composerForm: { display: 'flex', gap: '10px' },
    composerInput: { flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' },
    composerButton: { padding: '10px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', fontFamily: 'inherit' },
    suggestionsDropdown: { position: 'absolute', bottom: '100%', left: '0', right: '0', background: '#fff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', listStyle: 'none', padding: '0', margin: '0 0 6px 0', zIndex: 100, maxHeight: '140px', overflowY: 'auto' },
    suggestionItem: { padding: '8px 14px', cursor: 'pointer', fontSize: '0.9rem', color: '#333', borderBottom: '1px solid #f0f0f0', fontFamily: 'inherit' },
  
    floatingWrapper: { position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'inherit' },
    floatingTriggerBtn: { background: '#1e3a8a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'transform 0.1s ease', fontFamily: 'inherit' },
    modalCard: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '14px', width: '280px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', fontFamily: 'inherit' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' },
    closeXBtn: { background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#64748b', fontFamily: 'inherit' },
    settingSection: { display: 'flex', flexDirection: 'column', gap: '4px' },
    settingTitle: { fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b', fontFamily: 'inherit' },
    segmentedControl: { display: 'flex', background: '#f1f5f9', borderRadius: '4px', padding: '2px', gap: '2px' },
    segmentBtn: { flex: '1', padding: '4px', border: 'none', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' },
    themeGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' },
    themeBtn: { padding: '6px 2px', fontSize: '0.7rem', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' },
    rangeInput: { width: '100%', cursor: 'pointer' },
    resetBtn: { marginTop: '2px', padding: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }
  };
