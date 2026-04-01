// Gerenciador simples de estado usando LocalStorage
const Store = {
    save: (key, data) => {
        try {
            localStorage.setItem(`ctia03_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error("Erro ao salvar no localStorage", e);
        }
    },
    load: (key) => {
        try {
            const data = localStorage.getItem(`ctia03_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("Erro ao ler do localStorage", e);
            return null;
        }
    }
};
