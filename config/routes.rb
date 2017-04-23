Rails.application.routes.draw do

    resources :comments, except: [:index, :delete]
    get 'index/:id', to: 'comments#index'

    resources :songs, except: [:delete]

    #scope :api do
        mount_devise_token_auth_for 'User', at: 'auth'
    #end

    get 'users/:user_id/songs', to: 'users#songs'

  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
