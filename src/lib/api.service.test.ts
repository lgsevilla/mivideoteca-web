/**
 * TESTS DEL API SERVICE - REFERENCIA PARA EL ALUMNADO
 * 
 * Este archivo sirve como EJEMPLO de cómo testear servicios en SvelteKit.
 * Equivalente a auth_provider_test.dart de Flutter.
 * 
 * Patrón: ARRANGE → ACT → ASSERT
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api, ApiError } from './api.service';
import { authToken } from './auth.store.svelte';
const API_BASE_URL = 'https://mivideoteca-api-yud3.onrender.com';

// Mock de fetch global
globalThis.fetch = vi.fn() as any;

// Mock de localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock del módulo $app/environment
vi.mock('$app/environment', () => ({ browser: true }));

describe('API Service - Autenticación', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    vi.clearAllMocks();
    localStorageMock.clear();
    authToken.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // GRUPO: Login
  // ==========================================
  describe('Login', () => {
    it('debería iniciar sesión correctamente', async () => {
      // ARRANGE
      const email = 'test@example.com';
      const password = 'password123';
      const mockToken = 'fake-jwt-token';

      // Mock completo de la respuesta de fetch
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ token: mockToken })
      });

      // ACT
      const response = await api.login({ email, password });

      // ASSERT
      expect(response.token).toBe(mockToken);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      
      // Verificamos la llamada a fetch
      const callArgs = (globalThis.fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe(`${API_BASE_URL}/api/auth/login`);
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify({ email, password }));
    });

    it('debería fallar con credenciales incorrectas', async () => {
      // ARRANGE
      const email = 'bad@example.com';
      const password = 'wrongpassword';

      // Mock de respuesta de error 401 CON campo "error" en el JSON
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'Credenciales inválidas' })
      });

      // ACT & ASSERT
      try {
        await api.login({ email, password });
        expect(true).toBe(false); // Falla si no lanza error
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
        expect((error as ApiError).message).toBe('Credenciales inválidas');
      }
    });

    it('debería manejar errores de red', async () => {
      // ARRANGE
      (globalThis.fetch as any).mockRejectedValueOnce(
        new Error('Failed to fetch')
      );

      // ACT & ASSERT
      try {
        await api.login({ 
          email: 'test@example.com', 
          password: 'password' 
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('No se pudo conectar con el servidor.');
      }
    });
  });

  // ==========================================
  // GRUPO: Registro
  // ==========================================
  describe('Registro', () => {
    it('debería registrar usuario correctamente', async () => {
      // ARRANGE
      const email = 'nuevo@example.com';
      const password = 'password123';

      // Mock de registro exitoso (status 201)
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ message: 'Usuario registrado' })
      });

      // ACT
      await api.register({ email, password });

      // ASSERT
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      
      const callArgs = (globalThis.fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe(`${API_BASE_URL}/api/auth/register`);
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify({ email, password }));
    });

    it('debería fallar si el email ya existe', async () => {
      // ARRANGE
      const email = 'existente@example.com';
      const password = 'password123';

      // Mock de error 400
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'El email ya existe' })
      });

      // ACT & ASSERT
      try {
        await api.register({ email, password });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe('El email ya existe');
      }
    });
  });

  // ==========================================
  // GRUPO: Peticiones autenticadas
  // ==========================================
  describe('Peticiones con autenticación', () => {
    it('debería incluir token en el header Authorization', async () => {
      // ARRANGE
      const token = 'valid-token';
      authToken.set(token);

      // Mock de respuesta de películas
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ([])
      });

      // ACT
      await api.getMovies();

      // ASSERT
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      
      const callArgs = (globalThis.fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe(`${API_BASE_URL}/api/movies`);
      expect(callArgs[1].method).toBe('GET');
      
      // Verificar que el header Authorization está presente
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
    });

    it('debería fallar si no hay token (401)', async () => {
      // ARRANGE
      authToken.clear();

      // Mock de error 401
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'No autorizado' })
      });

      // ACT & ASSERT
      try {
        await api.getMovies();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
        expect((error as ApiError).message).toBe('No autorizado');
      }
    });
  });

  // ==========================================
  // GRUPO: Manejo de errores HTTP
  // ==========================================
  describe('Manejo de errores', () => {
    it('debería lanzar ApiError con código de estado correcto', async () => {
      // ARRANGE
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'Error del servidor' })
      });

      // ACT & ASSERT
      try {
        await api.login({ email: 'test@example.com', password: 'password' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe('Error del servidor');
      }
    });

    it('debería manejar respuestas sin campo error (fallback)', async () => {
      // ARRANGE - Sin campo "error" ni "message" en la respuesta
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({}) // Objeto vacío, sin error ni message
      });

      // ACT & ASSERT
      try {
        await api.getMovies();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        // Tu api.service devuelve este mensaje cuando no hay error/message
        expect((error as ApiError).message).toBe('Ocurrió un error inesperado.');
      }
    });
  });
});

/**
 * NOTAS PARA ESTUDIANTES:
 * 
 * 1. Estructura del mock de Response
 *    - ok: boolean (indica si status está en rango 200-299)
 *    - status: número del código HTTP
 *    - headers.get(): función para obtener headers
 *    - json(): función async que devuelve el body parseado
 * 
 * 2. Verificación de llamadas a fetch
 *    - mock.calls[0][0]: URL de la petición
 *    - mock.calls[0][1]: Opciones (method, headers, body)
 *    - Útil cuando Headers es un objeto complejo
 * 
 * 3. Manejo de errores en api.service
 *    - El código busca errorPayload.error o errorPayload.message
 *    - Si no encuentra ninguno, devuelve "Ocurrió un error inesperado."
 *    - Los tests deben reflejar este comportamiento
 * 
 * 4. try-catch en tests
 *    - expect(true).toBe(false) asegura que falle si NO lanza error
 *    - Nos permite verificar múltiples propiedades del error
 * 
 * 5. authToken.set() vs authToken.clear()
 *    - set(): Guarda token para peticiones autenticadas
 *    - clear(): Limpia token (simula logout)
 * 
 * 6. Diferencia con Flutter
 *    - Flutter: Mockeamos toda la clase ApiService
 *    - SvelteKit: Mockeamos fetch directamente
 *    - Ambos verifican el mismo comportamiento de negocio
 */