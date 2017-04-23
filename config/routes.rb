Rails.application.routes.draw do
  namespace :api do
    resources :comments, except: [:index]
    get 'index/:id', to: 'comments#index'

    resources :songs

    mount_devise_token_auth_for 'User', at: 'auth'
  end
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
